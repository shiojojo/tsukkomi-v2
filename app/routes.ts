import { index, route } from '@react-router/dev/routes';

export default [
  index('routes/_index.tsx'),
  route('404', 'routes/404.tsx'),
  route('500', 'routes/500.tsx'),
  route('answers', 'routes/answers._index.tsx'),
  route('answers/favorites', 'routes/answers.favorites.tsx'),
  route('api/line-ingest', 'routes/api.line-ingest.ts'),
  route('api/unused-image-urls', 'routes/api.unused-image-urls.ts'),
  route('login', 'routes/login.tsx'),
  route('me', 'routes/me.tsx'),
  route('topics', 'routes/topics._index.tsx'),
  route('topics/:id', 'routes/topics.$id._index.tsx'),
];
