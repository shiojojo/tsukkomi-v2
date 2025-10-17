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
  getFavoriteCounts,
  getFavoritesForProfile,
  getFavoriteAnswersForProfile,
} from './db/favorites';

// Comments domain
export {
  getCommentsByAnswer,
  getCommentsForAnswers,
  addComment,
} from './db/comments';

// Topics domain
export {
  getTopics,
  getTopicsPaged,
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
  getVotesForProfile,
  getProfileAnswerData,
  getVotesByForAnswers,
} from './db/votes';

// Line Sync domain - moved to direct import in api.line-ingest.ts to avoid browser bundling
