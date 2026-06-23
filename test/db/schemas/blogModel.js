/* Copyright (c) 2026 Future Internet Consulting and Development Solutions S.L.
 *
 * This file belongs to the business-ecosystem-logic-proxy of the
 * Business API Ecosystem
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

'use strict';

const Blog = require('../../../db/schemas/blogModel');

describe('Blog Model', () => {
    const basePayload = {
        title: 'My title',
        content: '# Content'
    };

    it('should validate and trim newly added fields', () => {
        const blog = new Blog({
            ...basePayload,
            slug: 'my-title',
            featuredImage: 'https://example.com/blog.png',
            metaDescription: '  This is a meta description.  ',
            excerpt: '  This is an excerpt.  ',
            author: '  Author name  ',
            partyId: '  party-123  '
        });

        const validationError = blog.validateSync();

        expect(validationError).toBeUndefined();
        expect(blog.metaDescription).toBe('This is a meta description.');
        expect(blog.excerpt).toBe('This is an excerpt.');
        expect(blog.author).toBe('Author name');
        expect(blog.partyId).toBe('party-123');
        expect(blog.tags).toEqual([]);
    });

    it('should trim tags and remove empty values', () => {
        const blog = new Blog({
            ...basePayload,
            tags: [
                '  Data   Science  ',
                '',
                '   ',
                'AI'
            ]
        });

        const validationError = blog.validateSync();

        expect(validationError).toBeUndefined();
        expect(blog.tags).toEqual([
            'Data   Science',
            'AI'
        ]);
    });

    it('should reject oversized tag values', () => {
        const blog = new Blog({
            ...basePayload,
            tags: ['x'.repeat(51)]
        });

        const validationError = blog.validateSync();

        expect(validationError).toBeDefined();
        expect(validationError.errors['tags.0']).toBeDefined();
    });

    it('should reject invalid slug format', () => {
        const blog = new Blog({
            ...basePayload,
            slug: 'Invalid-Slug'
        });

        const validationError = blog.validateSync();

        expect(validationError).toBeDefined();
        expect(validationError.errors.slug).toBeDefined();
    });

    it('should reject invalid featured image URL', () => {
        const blog = new Blog({
            ...basePayload,
            slug: 'valid-slug',
            featuredImage: 'not-a-valid-url'
        });

        const validationError = blog.validateSync();

        expect(validationError).toBeDefined();
        expect(validationError.errors.featuredImage).toBeDefined();
    });

    it('should reject oversized metaDescription and excerpt', () => {
        const blog = new Blog({
            ...basePayload,
            slug: 'valid-slug',
            metaDescription: 'a'.repeat(161),
            excerpt: 'b'.repeat(301)
        });

        const validationError = blog.validateSync();

        expect(validationError).toBeDefined();
        expect(validationError.errors.metaDescription).toBeDefined();
        expect(validationError.errors.excerpt).toBeDefined();
    });
});
