import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getWorkflowRecipe, renderWorkflowPrompt, WORKFLOW_RECIPES } from "../workflowRecipes.js";
import { ToolContext } from "./context.js";
import { safeTool } from "./toolUtils.js";

export function registerWorkflowTools(server: McpServer, _context: ToolContext): void {
  server.tool(
    "fabric_list_workflow_recipes",
    "List bundled Fabric operator workflow recipes mapped to specialized skills and tools.",
    {},
    () => safeTool(async () => WORKFLOW_RECIPES.map(({ id, title, skill, goal, outcome }) => ({ id, title, skill, goal, outcome })))
  );

  server.tool(
    "fabric_get_workflow_recipe",
    "Get one bundled Fabric operator workflow recipe by ID.",
    { id: z.string().min(1) },
    ({ id }) =>
      safeTool(async () => {
        const recipe = getWorkflowRecipe(id);
        return recipe ?? { blocked: true, blockers: [`Unknown workflow recipe: ${id}`] };
      })
  );

  server.tool(
    "fabric_generate_workflow_prompt",
    "Generate a ready-to-use operator prompt from a bundled Fabric workflow recipe.",
    { id: z.string().min(1) },
    ({ id }) =>
      safeTool(async () => {
        const recipe = getWorkflowRecipe(id);
        if (!recipe) return { blocked: true, blockers: [`Unknown workflow recipe: ${id}`] };
        return { prompt: renderWorkflowPrompt(recipe), recipe };
      })
  );
}
