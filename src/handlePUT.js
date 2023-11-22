import db from "./db.js";
import { firebaseApp } from "./firebaseconfig.js";
import { getAuth } from "firebase-admin/auth";
import { physicalTraitsAndBeautyIssuesExists } from "./utils.js";

export async function handlePUT(fastify) {
  fastify.put("/api/v1/users", async (request, reply) => {
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
        await updateUserBeautyProfile(form, currentUserId);
      }
      reply.code(302).send();
    } catch (error) {
      console.error(error);
      reply.code(401).send("Forbidden");
    }
  });
}

async function updateUserBeautyProfile(form, userId) {
  const arrOfSkinIssueIds = form.skin_issue_id.split(",");
  const arrOfHairIssueIds = form.hair_issue_id.split(",");
  await db("user_physical_trait").where("user_id", userId).update({
    skin_type_id: form.skin_type_id,
    hair_type_id: form.hair_type_id,
  });
  await db("user__skin_issue").where("user_id", userId).del();
  for (const skinIssueId of arrOfSkinIssueIds) {
    await db("user__skin_issue").insert({
      user_id: userId,
      skin_issue_id: skinIssueId,
    });
  }
  await db("user__hair_issue").where("user_id", userId).del();
  for (const hairIssueId of arrOfHairIssueIds) {
    await db("user__hair_issue").insert({
      user_id: userId,
      hair_issue_id: hairIssueId,
    });
  }
  return;
}
