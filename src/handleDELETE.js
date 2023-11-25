import db from "./db.js";
import { firebaseApp } from "./firebaseconfig.js";
import { getAuth } from "firebase-admin/auth";
import { physicalTraitsAndBeautyIssuesExists } from "./utils.js";

export async function handleDELETE(fastify) {
  fastify.delete("/api/v1/users", async (request, reply) => {
    const token = request.headers.authorization;

    if (!token || !token.startsWith("Bearer ")) {
      reply.code(401).send("Missing token");
    }
    const userToken = token.split("Bearer ")[1];

    try {
      const decodedToken = await getAuth(firebaseApp).verifyIdToken(userToken);
      const currentUserId = decodedToken.uid;
      await deleteUserBeautyProfile(currentUserId);
      reply.code(302).send();
    } catch (error) {
      console.error(error);
      reply.code(401).send("Forbidden");
    }
  });

  fastify.delete("/api/v1/user-favorite-recipe", async (request, reply) => {
    const token = request.headers.authorization;
    const body = request.body;
    console.log({ body });
    const recipeId = body.recipe_id;
    console.log({ recipeId });
    if (!token || !token.startsWith("Bearer ")) {
      reply.code(401).send("Missing token");
    }
    const userToken = token.split("Bearer ")[1];

    try {
      const decodedToken = await getAuth(firebaseApp).verifyIdToken(userToken);
      const currentUserId = decodedToken.uid;

      await deleteUserFavoriteRecipe(recipeId, currentUserId);
      reply.code(302).send();
    } catch (error) {
      console.error(error);
      reply.code(401).send("Forbidden");
    }
  });
}

async function deleteUserFavoriteRecipe(recipeId, userId) {
  await db("user__favorite_recipe")
    .where({
      recipe_id: recipeId,
      user_id: userId,
    })
    .del();
  return;
}

async function deleteUserBeautyProfile(userId) {
  await db("user_physical_trait").where("user_id", userId).del();
  await db("user__skin_issue").where("user_id", userId).del();
  await db("user__hair_issue").where("user_id", userId).del();
  return;
}
