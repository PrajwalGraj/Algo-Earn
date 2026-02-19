#!/usr/bin/env python3
"""Deploy a fresh bounty contract and get the new APP_ID"""

import os
import sys
from dotenv import load_dotenv

# Set up path
sys.path.insert(0, ".")

load_dotenv()

from smart_contracts.artifacts.bounty.bounty_client import BountyFactory
import algokit_utils
import logging

# Set up logging to see deployment progress
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

logger.info("Starting fresh bounty deployment...")

try:
    algorand = algokit_utils.AlgorandClient.from_environment()
    logger.info(f"Connected to: {algorand.client.algod.algod_address}")
    
    deployer = algorand.account.from_environment("DEPLOYER")
    logger.info(f"Deployer: {deployer.address}")
    
    factory = algorand.client.get_typed_app_factory(
        BountyFactory, default_sender=deployer.address
    )
    
    logger.info("Creating new app instance...")
    app_client, result = factory.deploy(
        on_update=algokit_utils.OnUpdate.AppendApp,
        on_schema_break=algokit_utils.OnSchemaBreak.AppendApp,
    )
    
    logger.info(f"✅ Deployment successful!")
    logger.info(f"📱 New APP_ID: {app_client.app_id}")
    logger.info(f"📍 App Address: {app_client.app_address}")
    logger.info(f"Operation: {result.operation_performed}")
    
    # Output the APP_ID plainly for easy capture
    print(f"\n🎯 NEW APP_ID: {app_client.app_id}")
    print(f"App Address: {app_client.app_address}\n")
    
except Exception as e:
    logger.error(f"❌ Deployment failed: {e}", exc_info=True)
    sys.exit(1)
