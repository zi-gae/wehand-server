import { Request, Response } from "express";
import { supabase } from "../lib/supabase";
import { ResponseHelper } from "../utils/response";
import { ApiError, asyncHandler } from "../middleware/errorHandler";
import { sanitizeString } from "../utils/helpers";

export const locationController = {
  // 2.2 지역 데이터 조회
  getRegions: asyncHandler(async (req: Request, res: Response) => {
    const { data: regions, error } = await supabase
      .from("regions")
      .select("id, name, type, parent_id, code")
      .order("name");

    if (error) {
      throw new ApiError(500, "지역 데이터 조회 실패", "REGIONS_FETCH_ERROR");
    }

    // 계층 구조로 정리
    const regionTree: Record<string, any> = {};
    const regionMap = new Map();

    // 먼저 모든 지역을 맵에 저장
    regions?.forEach((region) => {
      regionMap.set(region.id, {
        ...region,
        children: [],
      });
    });

    // 계층 구조 생성
    regions?.forEach((region) => {
      const regionData = regionMap.get(region.id);

      if (!region.parent_id) {
        // 최상위 지역 (시/도)
        regionTree[region.name] = {
          type: region.type,
          districts: region.type === "city" ? [] : {},
        };
      } else {
        // 하위 지역 처리
        const parent = regionMap.get(region.parent_id);
        if (parent) {
          const parentName = parent.name;

          if (parent.type === "city") {
            // 시 -> 구
            if (!regionTree[parentName]) {
              regionTree[parentName] = { type: "city", districts: [] };
            }
            regionTree[parentName].districts.push(region.name);
          } else if (parent.type === "province") {
            // 도 -> 시
            if (!regionTree[parentName]) {
              regionTree[parentName] = { type: "province", districts: {} };
            }

            // 시 하위의 구들 찾기
            const cityDistricts =
              regions
                ?.filter((r) => r.parent_id === region.id)
                .map((r) => r.name) || [];

            if (cityDistricts.length > 0) {
              regionTree[parentName].districts[region.name] = cityDistricts;
            } else {
              regionTree[parentName].districts[region.name] = [];
            }
          }
        }
      }
    });

    return ResponseHelper.success(res, { regions: regionTree });
  }),

  // 4.2 테니스장 검색
  searchVenues: asyncHandler(async (req: Request, res: Response) => {
    const { search, region } = req.query as {
      search?: string;
      region?: string;
    };

    let query = supabase
      .from("venues")
      .select(
        `
        id, name, address, courts, amenities, price_range, contact_phone,
        regions!inner(name)
      `
      )
      .eq("is_active", true);

    // 검색어 필터
    if (search) {
      const searchTerm = sanitizeString(search as string);
      query = query.or(
        `name.ilike.%${searchTerm}%,address.ilike.%${searchTerm}%`
      );
    }

    // 지역 필터
    if (region) {
      query = query.or(
        `address.ilike.%${region}%,regions.name.ilike.%${region}%`
      );
    }

    query = query.order("name").limit(50);

    const { data: venues, error } = await query;

    if (error) {
      throw new ApiError(500, "테니스장 검색 실패", "VENUES_SEARCH_ERROR");
    }

    const formattedVenues =
      venues?.map((venue) => ({
        id: venue.id,
        name: venue.name,
        address: venue.address,
        courts: venue.courts || [],
        amenities: venue.amenities || [],
        priceRange: venue.price_range || "가격 정보 없음",
        phone: venue.contact_phone || "",
      })) || [];

    return ResponseHelper.success(res, { venues: formattedVenues });
  }),

  // 테니스장 상세 정보 조회
  getVenueDetail: asyncHandler(async (req: Request, res: Response) => {
    const venueId = req.params.venueId;

    const { data: venue, error } = await supabase
      .from("venues")
      .select(
        `
        id, name, address, courts, amenities, price_range, contact_phone, website,
        operating_hours, location,
        regions!inner(name)
      `
      )
      .eq("id", venueId)
      .eq("is_active", true)
      .single();

    if (error || !venue) {
      throw new ApiError(404, "테니스장을 찾을 수 없습니다", "VENUE_NOT_FOUND");
    }

    const formattedVenue = {
      id: venue.id,
      name: venue.name,
      address: venue.address,
      region: (venue.regions as any)?.name || "",
      courts: venue.courts || [],
      amenities: venue.amenities || [],
      priceRange: venue.price_range || "가격 정보 없음",
      phone: venue.contact_phone || "",
      website: venue.website || "",
      operatingHours: venue.operating_hours || {},
      // 좌표 정보는 보안상 제공하지 않거나 제한적으로 제공
      hasLocation: !!venue.location,
    };

    return ResponseHelper.success(res, formattedVenue);
  }),

  // 근처 테니스장 조회
  getNearbyVenues: asyncHandler(async (req: Request, res: Response) => {
    const {
      lat,
      lng,
      radius = 10,
    } = req.query as {
      lat?: string;
      lng?: string;
      radius?: string;
    };

    if (!lat || !lng) {
      throw new ApiError(
        400,
        "위치 정보(위도, 경도)가 필요합니다",
        "MISSING_LOCATION"
      );
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    const searchRadius = parseInt(radius.toString()) * 1000; // km to meters

    if (isNaN(latitude) || isNaN(longitude)) {
      throw new ApiError(
        400,
        "올바른 위치 정보를 입력해주세요",
        "INVALID_COORDINATES"
      );
    }

    // PostGIS를 사용한 거리 기반 검색
    const { data: venues, error } = await supabase.rpc("get_nearby_venues", {
      user_lat: latitude,
      user_lng: longitude,
      radius_meters: searchRadius,
    });

    if (error) {
      throw new ApiError(500, "근처 테니스장 검색 실패", "NEARBY_VENUES_ERROR");
    }

    const formattedVenues =
      venues?.map((venue: any) => ({
        id: venue.id,
        name: venue.name,
        address: venue.address,
        courts: venue.courts || [],
        amenities: venue.amenities || [],
        priceRange: venue.price_range || "가격 정보 없음",
        distance: venue.distance
          ? `${(venue.distance / 1000).toFixed(1)}km`
          : null,
      })) || [];

    return ResponseHelper.success(res, { venues: formattedVenues });
  }),

  // 모든 테니스장 조회
  getAllVenues: asyncHandler(async (req: Request, res: Response) => {
    let allVenues: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    console.log("Starting to fetch all venues...");

    while (hasMore) {
      const { data: venues, error } = await supabase
        .from("venues")
        .select(
          "id, name, address, courts, amenities, price_range, contact_phone, region_id"
        )
        .eq("is_active", true)
        .order("name")
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) {
        console.error("Venues fetch error:", error);
        throw new ApiError(
          500,
          "테니스장 목록 조회 실패",
          "VENUES_FETCH_ERROR"
        );
      }

      if (!venues || venues.length === 0) {
        hasMore = false;
      } else {
        allVenues = [...allVenues, ...venues];
        console.log(
          `Page ${page + 1}: Retrieved ${venues.length} venues. Total so far: ${
            allVenues.length
          }`
        );

        if (venues.length < pageSize) {
          hasMore = false;
        }
        page++;
      }
    }

    console.log("Final total venues count:", allVenues.length);

    const formattedVenues = allVenues.map((venue) => ({
      id: venue.id,
      name: venue.name,
      address: venue.address,
      region: "", // 조인 제거로 인해 일시적으로 빈 값
      courts: venue.courts || [],
      amenities: venue.amenities || [],
      priceRange: venue.price_range || "가격 정보 없음",
      phone: venue.contact_phone || "",
    }));

    return ResponseHelper.success(res, {
      venues: formattedVenues,
      total: formattedVenues.length,
    });
  }),
};

// PostGIS 함수 (데이터베이스에 생성해야 함)
/*
CREATE OR REPLACE FUNCTION get_nearby_venues(
  user_lat DOUBLE PRECISION,
  user_lng DOUBLE PRECISION,
  radius_meters INTEGER DEFAULT 10000
)
RETURNS TABLE(
  id UUID,
  name TEXT,
  address TEXT,
  courts JSONB,
  amenities JSONB,
  price_range TEXT,
  distance DOUBLE PRECISION
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    v.id,
    v.name,
    v.address,
    v.courts,
    v.amenities,
    v.price_range,
    ST_Distance(
      v.location::geography,
      ST_SetSRID(ST_Point(user_lng, user_lat), 4326)::geography
    ) as distance
  FROM venues v
  WHERE v.is_active = true
    AND ST_DWithin(
      v.location::geography,
      ST_SetSRID(ST_Point(user_lng, user_lat), 4326)::geography,
      radius_meters
    )
  ORDER BY distance
  LIMIT 50;
END;
$$ LANGUAGE plpgsql;
*/
