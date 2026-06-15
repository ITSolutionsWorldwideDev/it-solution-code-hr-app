import { UTApi } from "uploadthing/server";
import fs from "fs/promises";
import pool from "../src/lib/db"; // apna db path

const utapi = new UTApi();

async function migrate() {
  const result = await pool.query(`
    SELECT id, file_path, file_name
    FROM media
  `);

  for (const item of result.rows) {
    try {
      console.log(`Uploading ${item.file_name}`);

      const buffer = await fs.readFile(item.file_path);

      const file = new File(
        [buffer],
        item.file_name,
        {
          type: "image/jpeg",
        }
      );

      const uploaded = await utapi.uploadFiles(file);

      if (uploaded.data?.ufsUrl) {
        await pool.query(
          `
          UPDATE media
          SET file_path = $1
          WHERE media_id = $2
          `,
          [uploaded.data.ufsUrl, item.id]
        );

        console.log(`Updated ${item.id}`);
      }
    } catch (err) {
      console.error(`Failed ${item.id}`, err);
    }
  }

  console.log("Migration completed");
}

migrate();