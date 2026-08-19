import type { WhisperComment } from "../types";

function getWhisperCommentCampaignSortValue(comment: WhisperComment): number | null {
  const { crown_year, bloom_index, petal, bell, chime } = comment;
  if (
    crown_year == null ||
    bloom_index == null ||
    petal == null ||
    bell == null ||
    chime == null
  ) {
    return null;
  }

  return (((crown_year * 12 + bloom_index) * 28 + petal) * 24 + bell) * 60 + chime;
}

/** Returns a new array ordered for reading from the earliest comment onward. */
export function sortWhisperCommentsChronologically(
  comments: WhisperComment[],
): WhisperComment[] {
  return [...comments].sort((a, b) => {
    const aCampaignTime = getWhisperCommentCampaignSortValue(a);
    const bCampaignTime = getWhisperCommentCampaignSortValue(b);

    if (aCampaignTime != null && bCampaignTime != null) {
      const campaignTimeDifference = aCampaignTime - bCampaignTime;
      if (campaignTimeDifference !== 0) return campaignTimeDifference;
    } else if (aCampaignTime != null) {
      return -1;
    } else if (bCampaignTime != null) {
      return 1;
    }

    const createdTimeDifference = Date.parse(a.created_at) - Date.parse(b.created_at);
    if (Number.isFinite(createdTimeDifference) && createdTimeDifference !== 0) {
      return createdTimeDifference;
    }

    return a.id - b.id;
  });
}
