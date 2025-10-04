import { describe, it, expect } from 'vitest';
import { parsePaginationParams, parseCommonFilterParams, parseAnswersFilterParams, parseFilterParams } from '~/lib/queryParser';

describe('queryParser', () => {
  describe('parsePaginationParams', () => {
    it('should parse page and pageSize from request', () => {
      const mockRequest = {
        url: 'http://example.com?page=2&pageSize=20',
      } as Request;

      const result = parsePaginationParams(mockRequest);

      expect(result).toEqual({
        page: 2,
        pageSize: 20,
      });
    });

    it('should use defaults when params are missing', () => {
      const mockRequest = {
        url: 'http://example.com',
      } as Request;

      const result = parsePaginationParams(mockRequest);

      expect(result).toEqual({
        page: 1,
        pageSize: 10,
      });
    });
  });

  describe('parseCommonFilterParams', () => {
    it('should parse q, fromDate, toDate from request', () => {
      const mockRequest = {
        url: 'http://example.com?q=test&fromDate=2023-01-01&toDate=2023-12-31',
      } as Request;

      const result = parseCommonFilterParams(mockRequest);

      expect(result).toEqual({
        q: 'test',
        fromDate: '2023-01-01',
        toDate: '2023-12-31',
      });
    });

    it('should return undefined for missing params', () => {
      const mockRequest = {
        url: 'http://example.com',
      } as Request;

      const result = parseCommonFilterParams(mockRequest);

      expect(result).toEqual({
        q: undefined,
        fromDate: undefined,
        toDate: undefined,
      });
    });
  });

  describe('parseAnswersFilterParams', () => {
    it('should parse answers specific filters', () => {
      const mockRequest = {
        url: 'http://example.com?q=test&authorName=user&sortBy=scoreDesc&minScore=5&hasComments=1',
      } as Request;

      const result = parseAnswersFilterParams(mockRequest);

      expect(result).toEqual({
        q: 'test',
        fromDate: undefined,
        toDate: undefined,
        author: 'user',
        sortBy: 'scoreDesc',
        minScore: 5,
        hasComments: true,
      });
    });

    it('should handle hasComments as string true', () => {
      const mockRequest = {
        url: 'http://example.com?hasComments=true',
      } as Request;

      const result = parseAnswersFilterParams(mockRequest);

      expect(result.hasComments).toBe(true);
    });
  });

  describe('parseFilterParams', () => {
    it('should return CommonFilterParams for topics', () => {
      const mockRequest = {
        url: 'http://example.com?q=test&fromDate=2023-01-01',
      } as Request;

      const result = parseFilterParams(mockRequest, 'topics');

      expect(result).toEqual({
        q: 'test',
        fromDate: '2023-01-01',
        toDate: undefined,
      });
    });

    it('should return AnswersFilterParams for answers', () => {
      const mockRequest = {
        url: 'http://example.com?q=test&authorName=user&sortBy=newest',
      } as Request;

      const result = parseFilterParams(mockRequest, 'answers');

      expect(result).toEqual({
        q: 'test',
        fromDate: undefined,
        toDate: undefined,
        author: 'user',
        sortBy: 'newest',
        minScore: undefined,
        hasComments: false,
      });
    });
  });
});