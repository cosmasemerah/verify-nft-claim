import dotenv from "dotenv";
import {
  createThirdwebClient,
  getContract,
  prepareEvent,
  getContractEvents,
} from "thirdweb";
import { tokensClaimedEvent } from "thirdweb/extensions/erc1155";
import { sepolia } from "thirdweb/chains";
import axios from "axios";
import fs from "fs/promises"; // Use promises for async/await
import path from "path";

dotenv.config();

// Path to the file where the last processed block is stored
const LAST_PROCESSED_BLOCK_FILE = path.resolve("lastProcessedBlock.json");

export default async function handler(req, res) {
  try {
    // Read the last processed block number from the file
    const lastProcessedBlock = await getLastProcessedBlock();

    const client = createThirdwebClient({
      secretKey: process.env.THIRDWEB_SECRET_KEY,
    });

    console.log("Client initialized");

    const contract = getContract({
      client,
      address: "0x9787cda13dDcEDCd42E7a5e3c1a09543c6bC19Ef",
      chain: sepolia,
    });

    console.log("Contract initialized");

    // Fetch past events from the last processed block
    const events = await getContractEvents({
      contract,
      fromBlock: lastProcessedBlock,
      events: [tokensClaimedEvent({})],
    });

    // Process the events and update the last processed block
    if (events.length > 0) {
      let latestBlock = lastProcessedBlock;

      for (const event of events) {
        console.log("Processing event:", event);
        const claimer = event.args.claimer.toString();
        console.log(`Claiming NFT for ${claimer}`);
        await verifyNFTClaim(claimer);

        // Update the latest processed block
        latestBlock = event.blockNumber;
      }

      // Save the latest block to the file
      await saveLastProcessedBlock(latestBlock);
    }

    res.status(200).json({ message: "Event processing completed" });
  } catch (error) {
    console.error("Error in handler:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

async function verifyNFTClaim(claimer) {
  try {
    const credId = process.env.GALXE_CRED_ID;
    const operation = "APPEND";
    const items = [claimer];

    const response = await axios.post(
      "https://graphigo.prd.galaxy.eco/query",
      {
        operationName: "credentialItems",
        query: `
          mutation credentialItems($credId: ID!, $operation: Operation!, $items: [String!]!) {
            credentialItems(input: {
              credId: $credId
              operation: $operation
              items: $items
            }) {
              name
            }
          }
        `,
        variables: {
          credId,
          operation,
          items,
        },
      },
      {
        headers: {
          "access-token": process.env.GALXE_ACCESS_TOKEN,
        },
      }
    );

    console.log(`Verification successful for ${claimer}:`, response.data);
  } catch (error) {
    console.error(`Verification failed for ${claimer}:`, error);
  }
}

// Utility function to get the last processed block number from a file
async function getLastProcessedBlock() {
  try {
    const data = await fs.readFile(LAST_PROCESSED_BLOCK_FILE, "utf-8");
    return BigInt(JSON.parse(data).lastBlock);
  } catch (error) {
    console.error("Error reading last processed block:", error);
    return 6509924n; // Start at block 6509924n if the file doesn't exist or an error occurs
  }
}

// Utility function to save the last processed block number to a file
async function saveLastProcessedBlock(blockNumber) {
  try {
    await fs.writeFile(
      LAST_PROCESSED_BLOCK_FILE,
      JSON.stringify({ lastBlock: blockNumber.toString() }),
      "utf-8"
    );
    console.log(`Saved last processed block: ${blockNumber}`);
  } catch (error) {
    console.error("Error saving last processed block:", error);
  }
}
