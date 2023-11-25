import db from "./db.js";
import { firebaseApp } from "./firebaseconfig.js";
import { getAuth } from "firebase-admin/auth";
import { physicalTraitsAndBeautyIssuesExists } from "./utils.js";

export async function handlePOST(fastify) {
  fastify.post("/api/v1/users", async (request, reply) => {
    const form = request.body;
    const token = request.headers.authorization;

    if (!token || !token.startsWith("Bearer ")) {
      reply.code(401).send("Missing token");
    }

    const userToken = token.split("Bearer ")[1];
    try {
      const decodedToken = await getAuth(firebaseApp).verifyIdToken(userToken);
      const currentUserId = decodedToken.uid;
      const dataExists = await physicalTraitsAndBeautyIssuesExists(form);
      if (dataExists) {
        await insertUserPhysicalTrait(form, currentUserId);
      }
      reply.code(302).send();
    } catch (error) {
      console.error(error);
      reply.code(401).send("Forbidden");
    }
  });

  fastify.post("/api/v1/user-favorite-recipe", async (request, reply) => {
    const form = request.body;
    const token = request.headers.authorization;

    if (!token || !token.startsWith("Bearer ")) {
      reply.code(401).send("Missing token");
    }

    const userToken = token.split("Bearer ")[1];
    try {
      const decodedToken = await getAuth(firebaseApp).verifyIdToken(userToken);
      const currentUserId = decodedToken.uid;

      await insertUserFavoriteRecipe(form, currentUserId);

      reply.code(302).send();
    } catch (error) {
      console.error(error);
      reply.code(401).send("Forbidden");
    }
  });
}

async function insertUserFavoriteRecipe(form, userId) {
  await db("user__favorite_recipe").insert({
    user_id: userId,
    recipe_id: form.recipe_id,
  });

  return;
}

async function insertUserPhysicalTrait(form, userId) {
  const arrOfSkinIssueIds = form.skin_issue_id.split(",");
  const arrOfHairIssueIds = form.hair_issue_id.split(",");

  await db("user_physical_trait").insert({
    user_id: userId,
    skin_type_id: form.skin_type_id,
    hair_type_id: form.hair_type_id,
  });
  for (const skinIssueId of arrOfSkinIssueIds) {
    await db("user__skin_issue").insert({
      user_id: userId,
      skin_issue_id: skinIssueId,
    });
  }
  for (const hairIssueId of arrOfHairIssueIds) {
    await db("user__hair_issue").insert({
      user_id: userId,
      hair_issue_id: hairIssueId,
    });
  }
  return;
}
