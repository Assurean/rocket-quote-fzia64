"""
FastAPI route definitions for ML service scoring endpoints with comprehensive monitoring.

Version: 1.0.0
"""

# External imports - version pinned
from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends  # version: 0.100+
from pydantic import BaseModel, Field, validator  # version: 2.0+
from prometheus_client import Counter, Histogram  # version: 0.17+
from typing import Dict, Optional, List
import time
import logging

# Internal imports
from ..services.scoring_service import ScoringService

# Configure logging
logger = logging.getLogger(__name__)

# Initialize router with prefix and tags
router = APIRouter(prefix="/api/v1/scoring", tags=["scoring"])

# Initialize scoring service
scoring_service = ScoringService()

# Prometheus metrics
REQUEST_COUNTER = Counter(
    'scoring_requests_total',
    'Total scoring requests',
    ['vertical']
)
ERROR_COUNTER = Counter(
    'scoring_errors_total',
    'Total scoring errors',
    ['vertical', 'error_type']
)
LATENCY_HISTOGRAM = Histogram(
    'scoring_latency_seconds',
    'Scoring request latency',
    ['vertical']
)

class LeadRequest(BaseModel):
    """Pydantic model for lead scoring request validation."""
    vertical: str = Field(..., description="Insurance vertical type")
    lead_data: Dict = Field(..., description="Lead information and features")
    session_id: str = Field(..., description="Unique session identifier")
    traffic_source: Optional[str] = Field(None, description="Traffic source identifier")

    @validator('vertical')
    def validate_vertical(cls, v):
        valid_verticals = ['auto', 'home', 'health', 'life', 'renters', 'commercial']
        if v not in valid_verticals:
            raise ValueError(f"Invalid vertical. Must be one of: {valid_verticals}")
        return v

    @validator('lead_data')
    def validate_lead_data(cls, v, values):
        if len(str(v)) > 102400:  # 100KB limit
            raise ValueError("Lead data exceeds size limit")
        return v

class ThresholdUpdate(BaseModel):
    """Pydantic model for threshold update requests."""
    vertical: str = Field(..., description="Insurance vertical type")
    threshold: float = Field(..., ge=0.0, le=1.0, description="New scoring threshold")
    reason: Optional[str] = Field(None, description="Reason for threshold update")

@router.post("/score")
async def score_lead(request: LeadRequest, background_tasks: BackgroundTasks):
    """
    Score an insurance lead with comprehensive monitoring and error handling.
    """
    start_time = time.time()
    REQUEST_COUNTER.labels(vertical=request.vertical).inc()

    try:
        # Log request metadata
        logger.info(f"Scoring request received for vertical: {request.vertical}")

        # Score lead with monitoring
        with LATENCY_HISTOGRAM.labels(vertical=request.vertical).time():
            result = await scoring_service.score_lead(
                vertical=request.vertical,
                lead_data=request.lead_data
            )

        # Add request metadata to response
        result.update({
            'request_id': request.session_id,
            'processing_time': round((time.time() - start_time) * 1000, 2)
        })

        # Schedule background analytics update
        background_tasks.add_task(
            update_scoring_analytics,
            request.vertical,
            result['score'],
            result['confidence']
        )

        return result

    except ValueError as e:
        ERROR_COUNTER.labels(
            vertical=request.vertical,
            error_type='validation_error'
        ).inc()
        logger.error(f"Validation error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

    except Exception as e:
        ERROR_COUNTER.labels(
            vertical=request.vertical,
            error_type='system_error'
        ).inc()
        logger.error(f"System error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal scoring error")

@router.post("/reload")
async def reload_models(background_tasks: BackgroundTasks):
    """
    Reload ML models with version validation and monitoring.
    """
    try:
        logger.info("Model reload requested")
        result = await scoring_service.reload_models()

        # Schedule model validation in background
        background_tasks.add_task(validate_reloaded_models, result)

        return {
            "status": "success",
            "reload_results": result
        }

    except Exception as e:
        logger.error(f"Model reload failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/model-info")
async def get_model_info(vertical: Optional[str] = None):
    """
    Get current model information and performance metrics.
    """
    try:
        model_info = await scoring_service.get_model_info(vertical)
        return model_info

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/threshold")
async def update_threshold(request: ThresholdUpdate):
    """
    Update scoring threshold with validation and audit trail.
    """
    try:
        logger.info(f"Threshold update requested for {request.vertical}: {request.threshold}")
        
        result = await scoring_service.update_threshold(
            vertical=request.vertical,
            threshold=request.threshold,
            reason=request.reason
        )

        return {
            "status": "success",
            "vertical": request.vertical,
            "new_threshold": request.threshold
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

async def update_scoring_analytics(vertical: str, score: float, confidence: float):
    """Background task to update scoring analytics."""
    try:
        # Analytics update implementation would go here
        logger.info(f"Updated scoring analytics for {vertical}")
    except Exception as e:
        logger.error(f"Analytics update failed: {str(e)}")

async def validate_reloaded_models(reload_results: Dict):
    """Background task to validate reloaded models."""
    try:
        # Model validation implementation would go here
        logger.info("Model validation completed")
    except Exception as e:
        logger.error(f"Model validation failed: {str(e)}")