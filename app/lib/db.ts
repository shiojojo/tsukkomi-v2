// Re-export all database functions from domain-specific modules
// This maintains backward compatibility while organizing code by domain

// Answers domain
export {
  getAnswers,
  getUserAnswerData,
  searchAnswers,
  getAnswersByTopic,
  getAnswersPageByTopic,
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
  getTopic,
} from './db/topics';

// Users domain
export {
  getUsers,
  addSubUser,
  removeSubUser,
  getProfilesByIds,
} from './db/users';

// Votes domain
export {
  getVotesForProfile,
  getProfileAnswerData,
  getVotesByForAnswers,
} from './db/votes';

// Line Sync domain
export {
  ingestLineAnswers,
  type LineAnswerIngestResult,
} from './db/lineSync';
