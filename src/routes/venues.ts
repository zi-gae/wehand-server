import { Router } from 'express';
import { locationController } from '../controllers/locationController';

const router = Router();

// 4.2 테니스장 검색
router.get('/', locationController.searchVenues);

// 테니스장 상세 정보 조회
router.get('/:venueId', locationController.getVenueDetail);

// 근처 테니스장 조회
router.get('/nearby', locationController.getNearbyVenues);

export default router;