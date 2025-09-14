import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { SaveScreenshot } from "./interface.js";
import type { ScreenshotMetadata, SaveScreenshotResult } from "./types.js";

export const saveScreenshotToR2: SaveScreenshot = async (
  buffer: Buffer,
  metadata: ScreenshotMetadata,
): Promise<SaveScreenshotResult> => {
  const endpointUrl = process.env.R2_ENDPOINT_URL;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME;

  if (!endpointUrl || !accessKeyId || !secretAccessKey || !bucketName) {
    throw new Error("Missing R2 environment variables");
  }

  const client = new S3Client({
    region: "auto",
    endpoint: endpointUrl,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  const date = new Date().toISOString().split("T")[0];
  const timestamp = Date.now();
  const key = `screenshots/${date}/${metadata.handlerName}/${metadata.requestId}/${metadata.status}_${timestamp}.png`;

  await client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: buffer,
      ContentType: "image/png",
      Metadata: {
        requestId: metadata.requestId,
        handlerName: metadata.handlerName,
        timestamp: metadata.timestamp,
        status: metadata.status,
      },
    }),
  );

  const url = await getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    }),
    { expiresIn: 3600 },
  );

  return { url, key };
};
