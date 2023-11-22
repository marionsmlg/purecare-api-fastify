import db from "./db.js";

export async function physicalTraitsAndBeautyIssuesExists(form) {
  const arrOfSkinIssueIds = form.skin_issue_id.split(",");
  const arrOfHairIssueIds = form.hair_issue_id.split(",");

  try {
    const resultSkinType = await db("physical_trait")
      .select("id")
      .where("id", form.skin_type_id);

    const resultHairType = await db("physical_trait")
      .select("id")
      .where("id", form.hair_type_id);
    for (const skinIssueId of arrOfSkinIssueIds) {
      const resultSkinIssue = await db("beauty_issue")
        .select("id")
        .where("id", skinIssueId);

      if (resultSkinIssue.length === 0) {
        return false;
      }
    }
    for (const hairIssueId of arrOfHairIssueIds) {
      const resultHairIssue = await db("beauty_issue")
        .select("id")
        .where("id", hairIssueId);

      if (resultHairIssue.length === 0) {
        return false;
      }
    }
    return resultSkinType.length > 0 && resultHairType.length > 0;
  } catch (error) {
    console.error(error);
    throw error;
  }
}
