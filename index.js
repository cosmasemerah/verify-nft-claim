import dotenv from "dotenv";
import {
  createThirdwebClient,
  getContract,
  getContractEvents,
  prepareEvent,
  watchContractEvents,
} from "thirdweb";
import { tokensClaimedEvent } from "thirdweb/extensions/erc1155";
import { sepolia } from "thirdweb/chains";
import axios from "axios";

dotenv.config();

(async () => {
  const client = createThirdwebClient({
    secretKey: process.env.THIRDWEB_SECRET_KEY,
  });

  console.log("Client initialized");

  const contract = getContract({
    client,
    address: "0x06F36dc531FAAd9A64F3Bc43040ee56939fEdA46",
    chain: sepolia,
  });

  console.log("Contract initialized");

  // Prepare the event to listen for
  const preparedEvent = prepareEvent({
    contract,
    signature:
      "event TokensClaimed(uint256 indexed claimConditionIndex, address indexed claimer, address indexed receiver, uint256 tokenId, uint256 quantityClaimed)",
  });

  const events = await getContractEvents({
    contract,
    events: [tokensClaimedEvent({})],
  });

  console.log(events);

  // Watch for events
  const unwatch = watchContractEvents({
    contract,
    events: [preparedEvent],
    onEvents: async (events) => {
      try {
        for (const event of events) {
          console.log("Processing event:", event);
          const claimer = event.args.claimer;
          console.log(`Claiming NFT for ${claimer}`);
          await verifyNFTClaim(claimer); // Await the async function
        }
      } catch (error) {
        console.error("Error processing events:", error);
      }
    },
  });

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
})();
