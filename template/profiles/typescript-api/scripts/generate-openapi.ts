import { z } from "zod";
import {
  maxQuoteBytes,
  quoteError,
  quoteInput,
  quoteMethod,
  quoteOutput,
  quotePath,
} from "../src/schemas/quotes";

function jsonContent(schema: z.ZodType) {
  return { "application/json": { schema: z.toJSONSchema(schema, { target: "openapi-3.0" }) } };
}

const contract = {
  openapi: "3.0.3",
  info: {
    title: "Reservation Quote API",
    description: "Quotes whether a party fits in the available seats without making a reservation.",
    version: "1.0.0",
    contact: { name: "Reservation Quote API maintainers" },
  },
  servers: [{ url: "http://127.0.0.1:3000" }],
  tags: [{ name: "Quotes", description: "Stateless reservation capacity quotes." }],
  paths: {
    [quotePath]: {
      [quoteMethod.toLowerCase()]: {
        tags: ["Quotes"],
        operationId: "createReservationQuote",
        summary: "Quote reservation capacity",
        description: "Returns whether the requested number of seats fits the stated capacity.",
        requestBody: {
          description: `A JSON document of at most ${maxQuoteBytes} bytes.`,
          required: true,
          content: jsonContent(quoteInput),
        },
        responses: {
          "200": { description: "Capacity decision.", content: jsonContent(quoteOutput) },
          "400": {
            description: "The JSON or its fields are invalid.",
            content: jsonContent(quoteError(400)),
          },
          "413": {
            description: "The request exceeds the documented body limit.",
            content: jsonContent(quoteError(413)),
          },
          "415": {
            description: "The request is missing the JSON media type.",
            content: jsonContent(quoteError(415)),
          },
        },
      },
    },
  },
};

console.log(JSON.stringify(contract, null, 2));
