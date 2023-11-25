import db from "./db.js";
import { firebaseApp } from "./firebaseconfig.js";
import { getAuth } from "firebase-admin/auth";
import { physicalTraitsAndBeautyIssuesExists } from "./utils.js";

export async function handleGET(fastify) {
  fastify.get("/", async function handler(request, reply) {
    return { status: "OK" };
  });

  let data;

  fastify.get("/api/v1/recipe-category", async (request, reply) => {
    data = await fetchDataFromTable("recipe_category");
    return data;
  });

  fastify.get("/api/v1/recipes", async function handler(request, reply) {
    const searchParams = request.query;
    if (searchParams.beauty_issue_slug) {
      data = await fetchRecipesByProblem(searchParams);
    } else {
      const [skinRecipes, hairRecipes] = await Promise.all([
        fetchSkinRecipes(searchParams),
        fetchHairRecipes(searchParams),
      ]);
      const dataExists = await physicalTraitsAndBeautyIssuesExists(
        searchParams
      );
      if (dataExists) {
        data = { skinRecipe: skinRecipes, hairRecipe: hairRecipes };
      }
    }

    return data;
  });

  fastify.get("/api/v1/beauty-issue", async (request, reply) => {
    const [hairIssue, skinIssue] = await Promise.all([
      fetchBeautyIssues("Cheveux"),
      fetchBeautyIssues("Visage"),
    ]);
    data = { hairIssue: hairIssue, skinIssue: skinIssue };
    return data;
  });

  fastify.get("/api/v1/skin-types", async (request, reply) => {
    data = await fetchSkinTypes();
    return data;
  });

  fastify.get("/api/v1/hair-types", async (request, reply) => {
    data = await fetchHairTypes("Cheveux");
    return data;
  });

  fastify.get("/api/v1/beauty-profile", async (request, reply) => {
    const searchParams = request.query;
    const dataExists = await physicalTraitsAndBeautyIssuesExists(searchParams);
    if (dataExists) {
      data = await fetchBeautyProfile(searchParams);
    }
    return data;
  });

  fastify.get("/api/v1/user-beauty-profile", async (request, reply) => {
    const searchParams = request.query;
    const decodedToken = await getAuth(firebaseApp).verifyIdToken(
      searchParams.user_token
    );
    const currentUserId = decodedToken.uid;

    const [userPhysicalTrait, userHairIssue, userSkinIssue] = await Promise.all(
      [
        fetchUserPhysicalTraits(currentUserId),
        fetchUserHairIssueId(currentUserId),
        await fetchUserSkinIssueId(currentUserId),
      ]
    );

    data = {
      physicalTrait: userPhysicalTrait,
      hairIssue: userHairIssue,
      skinIssue: userSkinIssue,
    };
    return data;
  });

  fastify.get("/api/v1/user-favorite-recipe", async (request, reply) => {
    const searchParams = request.query;
    const decodedToken = await getAuth(firebaseApp).verifyIdToken(
      searchParams.user_token
    );
    const currentUserId = decodedToken.uid;

    data = await fetchFavoriteRecipesByUserId(currentUserId, searchParams);
    return data;
  });

  fastify.get("/api/v1/recipe", async (request, reply) => {
    const searchParams = request.query;
    const recipeId = await fetchIdFromSlug("recipe", searchParams.slug);
    const [
      recipe,
      recipePhysicalTrait,
      recipeBeautyIssue,
      recipeIngredient,
      recipeAllergen,
      recipeStep,
      recipeBenefit,
    ] = await Promise.all([
      fetchRecipeById(recipeId),
      fetchRecipePhysicalTrait(recipeId),
      fetchRecipeBeautyIssues(recipeId),
      fetchRecipeIngredients(recipeId),
      fetchRecipeAllergens(recipeId),
      fetchRecipeSteps(recipeId),
      fetchRecipeBenefits(recipeId),
    ]);

    data = {
      recipe: recipe,
      physicalTrait: recipePhysicalTrait,
      beautyIssue: recipeBeautyIssue,
      ingredient: recipeIngredient,
      allergen: recipeAllergen,
      step: recipeStep,
      benefit: recipeBenefit,
    };
    return data;
  });

  fastify.get("/api/v1/user/:recipeId/like-status", async (request, reply) => {
    const searchParams = request.query;
    const recipeId = request.params.recipeId;
    const decodedToken = await getAuth(firebaseApp).verifyIdToken(
      searchParams.user_token
    );
    const currentUserId = decodedToken.uid;

    data = await isRecipeLikedByUser(currentUserId, recipeId);
    return data;
  });
}

async function isRecipeLikedByUser(userId, recipeId) {
  try {
    const result = await db("user__favorite_recipe")
      .select()
      .where({ user_id: userId, recipe_id: recipeId });

    return result.length > 0; // Si une correspondance est trouvée, la recette est aimée par l'utilisateur
  } catch (error) {
    console.error(
      "Erreur lors de la vérification de la recette en favori:",
      error
    );
    throw error;
  }
}

async function fetchFavoriteRecipesByUserId(userId, searchParams) {
  let query = db("recipe")
    .select(
      "recipe.id",
      "recipe.title",
      "recipe_category.name as recipe_category_name",
      "recipe.img_url",
      "recipe.preparation_time",
      "recipe.slug",
      "recipe_category.slug as recipe_category_slug",
      "user__favorite_recipe.created_at as favorite_created_at"
    )
    .countDistinct("recipe__ingredient.ingredient_id as ingredient_count")
    .innerJoin(
      "user__favorite_recipe",
      "recipe.id",
      "user__favorite_recipe.recipe_id"
    )
    .leftJoin("recipe__ingredient", "recipe.id", "recipe__ingredient.recipe_id")
    .leftJoin(
      "recipe_category",
      "recipe.recipe_category_id",
      "recipe_category.id"
    )
    .where("user_id", userId)

    .groupBy(
      "recipe.id",
      "recipe.title",
      "recipe.recipe_category_id",
      "recipe_category.name",
      "recipe.img_url",
      "recipe.preparation_time",
      "recipe_category_slug",
      "user__favorite_recipe.created_at"
    )
    .orderBy("user__favorite_recipe.created_at", "desc")
    .distinct()
    .limit(searchParams.limit);

  return await query;
}

async function fetchRecipesByProblem(searchParams) {
  const beautyIssueId = await fetchIdFromSlug(
    "beauty_issue",
    searchParams.beauty_issue_slug
  );
  let query = db("recipe")
    .select(
      "recipe.id",
      "recipe.title",
      "recipe_category.name as recipe_category_name",
      "recipe.img_url",
      "recipe.preparation_time",
      "recipe.slug",
      "recipe_category.slug as recipe_category_slug",
      "beauty_issue.name as beauty_issue_name"
    )
    .countDistinct("recipe__ingredient.ingredient_id as ingredient_count")
    .innerJoin(
      "recipe__beauty_issue",
      "recipe.id",
      "recipe__beauty_issue.recipe_id"
    )
    .innerJoin(
      "recipe__physical_trait",
      "recipe.id",
      "recipe__physical_trait.recipe_id"
    )
    .leftJoin("recipe__ingredient", "recipe.id", "recipe__ingredient.recipe_id")
    .leftJoin(
      "recipe_category",
      "recipe.recipe_category_id",
      "recipe_category.id"
    )
    .leftJoin("beauty_issue", function () {
      this.on("beauty_issue.id", "=", "recipe__beauty_issue.beauty_issue_id");
    })
    .where("recipe__beauty_issue.beauty_issue_id", beautyIssueId)

    .groupBy(
      "recipe.id",
      "recipe.title",
      "recipe.recipe_category_id",
      "recipe_category.name",
      "recipe.img_url",
      "recipe.preparation_time",
      "recipe_category_slug",
      "beauty_issue.name"
    )
    .distinct()
    .limit(searchParams.limit);

  return await query;
}

async function fetchSkinRecipes(searchParams) {
  const arrOfSkinIssueIds = searchParams.skin_issue_id.split(",");
  let query = db("recipe")
    .select(
      "recipe.id",
      "recipe.title",
      "recipe_category.name as recipe_category_name",
      "recipe.img_url",
      "recipe.preparation_time",
      "recipe.slug",
      "recipe_category.slug as recipe_category_slug"
    )
    .countDistinct("recipe__ingredient.ingredient_id as ingredient_count")
    .innerJoin(
      "recipe__beauty_issue",
      "recipe.id",
      "recipe__beauty_issue.recipe_id"
    )
    .innerJoin(
      "recipe__physical_trait",
      "recipe.id",
      "recipe__physical_trait.recipe_id"
    )
    .leftJoin("recipe__ingredient", "recipe.id", "recipe__ingredient.recipe_id")
    .leftJoin(
      "recipe_category",
      "recipe.recipe_category_id",
      "recipe_category.id"
    )

    .where(function () {
      this.where(function () {
        this.whereIn(
          "recipe__beauty_issue.beauty_issue_id",
          arrOfSkinIssueIds
        ).orWhere(
          "recipe__beauty_issue.beauty_issue_id",
          "1ddab218-5489-4891-8fbb-1c7061271dc8"
        );
      }).andWhere(function () {
        this.whereIn("recipe__physical_trait.physical_trait_id", [
          searchParams.skin_type_id,
          "b9f90678-ea3f-4fde-952f-a26a88e13259",
        ]);
      });
    })
    .groupBy(
      "recipe.id",
      "recipe.title",
      "recipe.recipe_category_id",
      "recipe_category.name",
      "recipe.img_url",
      "recipe.preparation_time",
      "recipe_category_slug"
    )
    .distinct()
    .orderBy("recipe.title")

    .limit(searchParams.limit);

  return await query;
}

async function fetchHairRecipes(searchParams) {
  const arrOfHairIssueIds = searchParams.hair_issue_id.split(",");

  let query = db("recipe")
    .select(
      "recipe.id",
      "recipe.title",
      "recipe_category.name as recipe_category_name",
      "recipe.img_url",
      "recipe.preparation_time",
      "recipe.slug",
      "recipe_category.slug as recipe_category_slug"
    )
    .countDistinct("recipe__ingredient.ingredient_id as ingredient_count")
    .innerJoin(
      "recipe__beauty_issue",
      "recipe.id",
      "recipe__beauty_issue.recipe_id"
    )
    .innerJoin(
      "recipe__physical_trait",
      "recipe.id",
      "recipe__physical_trait.recipe_id"
    )
    .leftJoin("recipe__ingredient", "recipe.id", "recipe__ingredient.recipe_id")
    .leftJoin(
      "recipe_category",
      "recipe.recipe_category_id",
      "recipe_category.id"
    )
    .where(function () {
      this.where(function () {
        this.whereIn(
          "recipe__beauty_issue.beauty_issue_id",
          arrOfHairIssueIds
        ).orWhere(
          "recipe__beauty_issue.beauty_issue_id",
          "77b4ae6d-a31f-4de5-a731-1249cd87eeff"
        );
      }).andWhere(function () {
        this.whereIn("recipe__physical_trait.physical_trait_id", [
          searchParams.hair_type_id,
          "c8898a24-04cb-4b1f-bb8b-38633aa3c670",
        ]);
      });
    })
    .groupBy(
      "recipe.id",
      "recipe.title",
      "recipe.recipe_category_id",
      "recipe_category.name",
      "recipe.img_url",
      "recipe.preparation_time",
      "recipe_category_slug"
    )
    .distinct()
    .orderBy("recipe.title")
    .limit(searchParams.limit);

  return await query;
}

async function fetchRecipeById(recipeId) {
  return await db
    .select(
      "recipe.id",
      "recipe.title",
      "recipe.recipe_category_id",
      "recipe.product_quantity",
      "recipe.product_quantity_unit",
      "recipe.img_url",
      "recipe.preparation_time",
      "recipe.product_texture_type_id",
      "recipe.instructions",
      "recipe.storage_time",
      "recipe.storage_method",
      "recipe.safety_precautions",
      "product_texture_type.name as product_texture_type_name",
      "recipe_category.name as recipe_category_name"
    )
    .from("recipe")
    .join(
      "product_texture_type",
      "recipe.product_texture_type_id",
      "product_texture_type.id"
    )
    .join("recipe_category", "recipe.recipe_category_id", "recipe_category.id")
    .where("recipe.id", recipeId);
}
async function fetchDataFromTable(tableName) {
  return await db(tableName).select("*").orderBy("created_at", "desc");
}

async function fetchRecipeIngredients(recipeId) {
  return await db("recipe__ingredient")
    .select("*")
    .where("recipe_id", recipeId)
    .leftJoin("ingredient", "recipe__ingredient.ingredient_id", "ingredient.id")
    .orderBy("ingredient_priority_number");
}
async function fetchRecipeSteps(recipeId) {
  return await db("recipe__step")
    .select("*")
    .where("recipe_id", recipeId)
    .orderBy("step_number");
}

async function fetchRecipeBenefits(recipeId) {
  return await db("recipe__product_benefit")
    .select("name")
    .where("recipe_id", recipeId)
    .leftJoin(
      "product_benefit",
      "recipe__product_benefit.product_benefit_id",
      "product_benefit.id"
    )
    .orderBy("name");
}
async function fetchRecipeAllergens(recipeId) {
  return await db("recipe__product_allergen")
    .select("name")
    .where("recipe_id", recipeId)
    .leftJoin(
      "product_allergen",
      "recipe__product_allergen.product_allergen_id",
      "product_allergen.id"
    )
    .orderBy("name");
}

async function fetchRecipeBeautyIssues(recipeId) {
  return await db("recipe__beauty_issue")
    .select("name")
    .where("recipe_id", recipeId)
    .leftJoin(
      "beauty_issue",
      "recipe__beauty_issue.beauty_issue_id",
      "beauty_issue.id"
    )
    .orderBy("name");
}
async function fetchRecipePhysicalTrait(recipeId) {
  return await db("recipe__physical_trait")
    .select("name")
    .where("recipe_id", recipeId)
    .leftJoin(
      "physical_trait",
      "recipe__physical_trait.physical_trait_id",
      "physical_trait.id"
    )
    .orderBy("name");
}

async function fetchSkinTypes() {
  return await db("physical_trait")
    .select(
      "physical_trait.id",
      "physical_trait.name",
      "physical_trait.slug",
      "physical_trait.description",
      "recipe_category.name as recipe_category_name"
    )
    .leftJoin(
      "recipe_category",
      "physical_trait.recipe_category_id",
      "recipe_category.id"
    )
    .where("recipe_category.name", "Visage")
    .whereNot("physical_trait.name", "Tous types");
}

async function fetchHairTypes() {
  return await db("physical_trait")
    .select(
      "physical_trait.id",
      "physical_trait.name",
      "physical_trait.slug",
      "recipe_category.name as recipe_category_name"
    )
    .leftJoin(
      "recipe_category",
      "physical_trait.recipe_category_id",
      "recipe_category.id"
    )
    .where("recipe_category.name", "Cheveux")
    .whereNot("physical_trait.name", "Tous types");
}

async function fetchBeautyIssues(categoryName) {
  return await db("beauty_issue")
    .select(
      "beauty_issue.id",
      "beauty_issue.name",
      "beauty_issue.slug",
      "recipe_category.name as recipe_category_name"
    )
    .leftJoin(
      "recipe_category",
      "beauty_issue.recipe_category_id",
      "recipe_category.id"
    )
    .where("recipe_category.name", categoryName);
}

async function fetchIdFromSlug(tableName, slug) {
  const arrWithId = await db(tableName).select("id").where("slug", slug);
  const id = arrWithId[0].id;
  return id;
}

async function fetchUserHairIssueId(currentUserId) {
  try {
    const query = await db("user__hair_issue")
      .select("hair_issue_id")
      .where("user_id", currentUserId);
    return query;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

async function fetchUserSkinIssueId(currentUserId) {
  try {
    const query = await db("user__skin_issue")
      .select("skin_issue_id")
      .where("user_id", currentUserId);
    return query;
  } catch (error) {
    console.error(error);
    throw error;
  }
}
async function fetchUserPhysicalTraits(currentUserId) {
  try {
    const query = await db("user_physical_trait")
      .select("skin_type_id", "hair_type_id")
      .where("user_id", currentUserId);
    return query;
  } catch (error) {
    console.error(error);
    throw error;
  }
}
async function fetchBeautyProfile(searchParams) {
  const arrOfSkinIssueIds = searchParams.skin_issue_id.split(",");
  const arrOfHairIssueIds = searchParams.hair_issue_id.split(",");
  try {
    const skinType = await db("physical_trait")
      .select("physical_trait.id", "physical_trait.name")
      .where("id", searchParams.skin_type_id);

    const hairType = await db("physical_trait")
      .select("physical_trait.id", "physical_trait.name")
      .where("id", searchParams.hair_type_id);

    const hairIssue = await db("beauty_issue")
      .select("beauty_issue.id", "beauty_issue.name")
      .whereIn("id", arrOfHairIssueIds);
    const skinIssue = await db("beauty_issue")
      .select("beauty_issue.id", "beauty_issue.name")
      .whereIn("id", arrOfSkinIssueIds);

    return {
      skinType: skinType,
      hairType: hairType,
      skinIssue: skinIssue,
      hairIssue: hairIssue,
    };
  } catch (error) {
    console.error(error);
    throw error;
  }
}
