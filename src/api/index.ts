import { Router } from 'express';
import gltfPipelineRoutes from './gltf-pipeline-api';
import gltfTransformRoutes from './gltf-transform-api';

const router = Router();

// Register API routes
router.use('/gltf', gltfPipelineRoutes);
router.use('/transform', gltfTransformRoutes);

export default router;
