// Re-export all database functions from domain-specific modules
// This maintains backward compatibility while organizing code by domain

// Answers domain
export {
  getAnswers,
  getUserAnswerData,
  searchAnswers,
  voteAnswer,
} from './db/answers';

// Favorites domain
export {
  addFavorite,
  removeFavorite,
  toggleFavorite,
  getFavoritesForProfile,
  getFavoriteAnswersForProfile,
} from './db/favorites';

// Comments domain
export {
  getCommentsByAnswer,
  getCommentsForAnswers,
  getCommentCountsForAnswers,
  addComment,
} from './db/comments';

// Topics domain
export {
  getTopics,
  getTopicsPaged,
  getTopicsByIds,
  getLatestTopic,
} from './db/topics';

// Users domain
export {
  getUsers,
  addSubUser,
  removeSubUser,
} from './db/users';

// Votes domain
export {
  getProfileAnswerData,
  getVotesByForAnswers,
} from './db/votes';

// Line Sync domain - moved to direct import in api.line-ingest.ts to avoid browser bundling
