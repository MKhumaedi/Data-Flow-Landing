import { z } from 'zod';

export const createDatasetSchema = z
  .object({
    id: z.string().optional(),
    fileName: z.string().optional(),
    filename: z.string().optional(),
    fileSize: z.number().nonnegative().optional().default(0),
    fileType: z.string().optional().default('xlsx'),
    rowCount: z.number().nonnegative().optional().default(0),
    columnCount: z.number().nonnegative().optional().default(0),
    columns: z
      .array(
        z
          .object({
            name: z.string(),
            dataType: z.string().optional(),
            type: z.string().optional(),
          })
          .passthrough()
      )
      .optional()
      .default([]),
    sampleData: z.array(z.record(z.string(), z.any())).optional(),
    data: z.array(z.record(z.string(), z.any())).optional(),
    validationIssues: z.array(z.any()).optional(),
    isCleaned: z.boolean().optional(),
  })
  .passthrough();

