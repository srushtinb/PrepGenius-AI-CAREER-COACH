import { db } from "@/lib/prisma";
import { inngest } from "./client";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Ensure the API key is defined
const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error("GEMINI_API_KEY is not set in the environment.");
}

const genAI = new GoogleGenerativeAI(apiKey);

// Helper function to try multiple models with fallback
async function generateWithModelFallback(prompt: string): Promise<string> {
  const modelsToTry = [
    "gemini-1.5-flash",
    "gemini-1.5-pro",
    "gemini-pro",
    "gemini-2.0-flash-exp",
  ];

  for (const modelName of modelsToTry) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
      });

      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      console.log(`✅ Successfully used model: ${modelName}`);

      return text;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      const errorStatus = (error as { status?: number })?.status;

      if (errorMessage.includes("404") || errorStatus === 404) {
        console.log(`⚠️ Model ${modelName} not available, trying next...`);

        continue;
      }

      console.error(`Error with model ${modelName}:`, error);

      continue;
    }
  }

  throw new Error("All Gemini models failed");
}

// =========================
// TYPES
// =========================

interface SalaryRange {
  role: string;
  min: number;
  max: number;
  median: number;
  location: string;
}

interface IndustryInsightJSON {
  salaryRanges: SalaryRange[];
  growthRate: number;
  demandLevel: "High" | "Medium" | "Low";
  topSkills: string[];
  marketOutlook: "Positive" | "Neutral" | "Negative";
  keyTrends: string[];
  recommendedSkills: string[];
}

// =========================
// INDUSTRY INSIGHTS
// =========================

export const generateIndustryInsights = inngest.createFunction(
  {
    id: "generate-industry-insights",

    triggers: [
      {
        cron: "0 0 * * 0",
      },
    ],
  },

  async ({ step }) => {
    const industries = await step.run("Fetch industries", async () => {
      return await db.industryInsight.findMany({
        select: {
          industry: true,
        },
      });
    });

    for (const { industry } of industries) {
      const prompt = `
Analyze the current state of the ${industry} industry and provide insights in ONLY the following JSON format:

{
  "salaryRanges": [
    {
      "role": "string",
      "min": number,
      "max": number,
      "median": number,
      "location": "string"
    }
  ],
  "growthRate": number,
  "demandLevel": "High" | "Medium" | "Low",
  "topSkills": ["skill1", "skill2"],
  "marketOutlook": "Positive" | "Neutral" | "Negative",
  "keyTrends": ["trend1", "trend2"],
  "recommendedSkills": ["skill1", "skill2"]
}

IMPORTANT:
- Return ONLY JSON
- Include at least 5 roles
- Include at least 5 skills
`;

      const text = await step.run(
        `Generate insights for ${industry}`,
        async () => {
          return await generateWithModelFallback(prompt);
        },
      );

      const cleanedText = text.replace(/```(?:json)?\n?/g, "").trim();

      try {
        const insights: IndustryInsightJSON = JSON.parse(cleanedText);

        await step.run(`Update ${industry} insights`, async () => {
          await db.industryInsight.update({
            where: {
              industry,
            },

            data: {
              ...insights,

              salaryRanges: JSON.parse(JSON.stringify(insights.salaryRanges)),

              lastUpdated: new Date(),

              nextUpdate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
          });
        });
      } catch (error) {
        console.error(`Failed to parse JSON for ${industry}`, error);
      }
    }
  },
);

// =========================
// JOB OPPORTUNITIES
// =========================

export const fetchJobOpportunities = inngest.createFunction(
  {
    id: "fetch-job-opportunities",

    triggers: [
      {
        cron: "0 6 * * *",
      },
    ],
  },

  async ({ step }) => {
    const industries = await step.run("Fetch industries", async () => {
      return await db.industryInsight.findMany({
        select: {
          industry: true,
        },
      });
    });

    for (const { industry } of industries) {
      const prompt = `
Search for current internships and jobs in ${industry} industry.

Return ONLY JSON:

{
  "jobs": [
    {
      "title": "string",
      "company": "string",
      "location": "string",
      "type": "internship",
      "description": "string",
      "requirements": ["req1"],
      "skills": ["skill1"],
      "salary": "string",
      "experience": "string",
      "platform": "linkedin",
      "url": "string",
      "postedDate": "YYYY-MM-DD",
      "deadline": "YYYY-MM-DD"
    }
  ]
}
`;

      const text = await step.run(`Generate jobs for ${industry}`, async () => {
        return await generateWithModelFallback(prompt);
      });

      const cleanedText = text.replace(/```(?:json)?\n?/g, "").trim();

      try {
        const jobData = JSON.parse(cleanedText);

        await step.run(`Deactivate old jobs for ${industry}`, async () => {
          await db.jobOpportunity.updateMany({
            where: {
              industry,
              isActive: true,
            },

            data: {
              isActive: false,
            },
          });
        });

        if (jobData.jobs && Array.isArray(jobData.jobs)) {
          await step.run(`Create jobs for ${industry}`, async () => {
            for (const job of jobData.jobs) {
              await db.jobOpportunity.create({
                data: {
                  title: job.title,
                  company: job.company,
                  location: job.location,
                  type: job.type,
                  industry,

                  description: job.description,

                  requirements: job.requirements || [],

                  skills: job.skills || [],

                  salary: job.salary,

                  experience: job.experience,

                  platform: job.platform,

                  url: job.url,

                  postedDate: new Date(job.postedDate),

                  deadline: job.deadline ? new Date(job.deadline) : null,
                },
              });
            }
          });
        }
      } catch (error) {
        console.error(`Failed to parse jobs for ${industry}`, error);
      }
    }
  },
);
