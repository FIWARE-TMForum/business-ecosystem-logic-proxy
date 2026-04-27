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

const proxyquire = require('proxyquire').noCallThru();

describe('DomeBlog Controller', () => {
    let BlogMock;
    let indexesMock;
    let utilsMock;
    let configMock;
    let controller;

    const makeResponse = () => {
        const res = jasmine.createSpyObj('res', ['status', 'send', 'json']);
        res.status.and.returnValue(res);
        return res;
    };

    const makeBlogModel = (opts) => {
        const options = opts || {};
        const saveImplementation = options.saveImplementation || (async function() { return this; });

        const Blog = jasmine.createSpy('Blog').and.callFake(function(data) {
            Object.assign(this, data);
            this._id = this._id || 'blog-id-1';
            this.save = jasmine.createSpy('save').and.callFake(saveImplementation.bind(this));
        });

        Blog.exists = jasmine.createSpy('exists').and.returnValue(Promise.resolve(null));
        Blog.find = jasmine.createSpy('find');
        Blog.findById = jasmine.createSpy('findById');
        Blog.findByIdAndDelete = jasmine.createSpy('findByIdAndDelete');

        return Blog;
    };

    const loadController = () => {
        controller = proxyquire('../../controllers/domeBlog', {
            '../db/schemas/blogModel': BlogMock,
            '../lib/indexes': { indexes: indexesMock },
            '../lib/utils': utilsMock,
            '../config': configMock
        }).domeBlog;
    };

    beforeEach(() => {
        BlogMock = makeBlogModel();
        indexesMock = {
            indexDocument: jasmine.createSpy('indexDocument')
        };
        utilsMock = {
            hasRole: jasmine.createSpy('hasRole').and.returnValue(true)
        };
        configMock = {
            roles: {
                admin: 'provider'
            }
        };

        loadController();
    });

    it('should return 403 when a non-admin tries to create a post', async () => {
        utilsMock.hasRole.and.returnValue(false);

        const req = {
            user: { roles: [{ name: 'buyer' }] },
            body: JSON.stringify({
                title: 'New Blog Post',
                content: '# Heading'
            })
        };
        const res = makeResponse();

        await controller.create(req, res);

        expect(BlogMock).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.send).toHaveBeenCalledWith('Only administrators can create entries');
    });

    it('should create a post with the new blog fields', async () => {
        const req = {
            user: { roles: [{ name: 'provider' }] },
            body: JSON.stringify({
                title: 'New Blog Post',
                slug: 'new-blog-post',
                featuredImage: 'https://example.com/post.png',
                metaDescription: 'Small description',
                excerpt: 'Small excerpt',
                content: '# Heading',
                partyId: 'party-1',
                author: 'Admin',
                tags: ['  Data   Space  ', 'AI', '', '  ']
            })
        };
        const res = makeResponse();

        await controller.create(req, res);

        const createSlugCheckQuery = BlogMock.exists.calls.mostRecent().args[0];
        expect(createSlugCheckQuery.$or[0]).toEqual({ slugNormalized: 'new-blog-post' });
        expect(BlogMock).toHaveBeenCalledWith(jasmine.objectContaining({
            title: 'New Blog Post',
            slug: 'new-blog-post',
            featuredImage: 'https://example.com/post.png',
            metaDescription: 'Small description',
            excerpt: 'Small excerpt',
            content: '# Heading',
            partyId: 'party-1',
            author: 'Admin',
            tags: ['Data   Space', 'AI']
        }));
        expect(indexesMock.indexDocument).toHaveBeenCalledWith(
            'blog',
            jasmine.any(String),
            jasmine.objectContaining({
                slug: 'new-blog-post',
                featuredImage: 'https://example.com/post.png',
                metaDescription: 'Small description',
                excerpt: 'Small excerpt',
                tags: ['Data   Space', 'AI']
            })
        );
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalled();
    });

    it('should auto-generate slug when legacy payload does not include it', async () => {
        const req = {
            user: { roles: [{ name: 'provider' }] },
            body: JSON.stringify({
                title: 'Legacy Post Title',
                content: 'Body'
            })
        };
        const res = makeResponse();

        await controller.create(req, res);

        const legacySlugCheckQuery = BlogMock.exists.calls.mostRecent().args[0];
        expect(legacySlugCheckQuery.$or[0]).toEqual({ slugNormalized: 'legacy-post-title' });
        expect(BlogMock).toHaveBeenCalledWith(jasmine.objectContaining({
            title: 'Legacy Post Title',
            slug: 'legacy-post-title',
            content: 'Body'
        }));
        expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should return 400 when create payload is not valid JSON', async () => {
        const req = {
            user: { roles: [{ name: 'provider' }] },
            body: '{invalid-json'
        };
        const res = makeResponse();

        await controller.create(req, res);

        expect(BlogMock).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            error: 'Invalid JSON body'
        });
    });

    it('should return 400 when tags is not an array', async () => {
        const req = {
            user: { roles: [{ name: 'provider' }] },
            body: JSON.stringify({
                title: 'Tag normalization',
                content: 'Body',
                tags: 'AI,Data'
            })
        };
        const res = makeResponse();

        await controller.create(req, res);

        expect(BlogMock).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(jasmine.objectContaining({
            error: 'tags must be an array of strings'
        }));
    });

    it('should return 403 when a non-admin tries to update a post', async () => {
        utilsMock.hasRole.and.returnValue(false);

        const req = {
            user: { roles: [{ name: 'buyer' }] },
            params: { id: 'blog-id-1' },
            body: JSON.stringify({
                title: 'Updated title'
            })
        };
        const res = makeResponse();

        await controller.updateById(req, res);

        expect(BlogMock.findById).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.send).toHaveBeenCalledWith('Only administrators can update entries');
    });

    it('should update the new blog fields through patch', async () => {
        const existingBlog = {
            _id: 'blog-id-1',
            title: 'Legacy title',
            slug: 'legacy-title',
            content: '# Existing',
            save: jasmine.createSpy('save').and.callFake(async function() { return this; })
        };
        BlogMock.findById.and.returnValue(Promise.resolve(existingBlog));

        const req = {
            user: { roles: [{ name: 'provider' }] },
            params: { id: 'blog-id-1' },
            body: JSON.stringify({
                title: 'Updated title',
                slug: 'updated-title',
                featuredImage: 'https://example.com/new-image.jpg',
                metaDescription: 'Updated description',
                excerpt: 'Updated excerpt',
                author: 'Updated Author'
            })
        };
        const res = makeResponse();

        await controller.updateById(req, res);

        expect(BlogMock.findById).toHaveBeenCalledWith('blog-id-1');
        const updateSlugCheckQuery = BlogMock.exists.calls.mostRecent().args[0];
        expect(updateSlugCheckQuery.$or[0]).toEqual({ slugNormalized: 'updated-title' });
        expect(updateSlugCheckQuery._id).toEqual({ $ne: 'blog-id-1' });
        expect(existingBlog.title).toBe('Updated title');
        expect(existingBlog.slug).toBe('updated-title');
        expect(existingBlog.featuredImage).toBe('https://example.com/new-image.jpg');
        expect(existingBlog.metaDescription).toBe('Updated description');
        expect(existingBlog.excerpt).toBe('Updated excerpt');
        expect(existingBlog.author).toBe('Updated Author');
        expect(existingBlog.save).toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith({
            message: 'Blog entry patched successfully',
            patchedBlog: existingBlog
        });
    });

    it('should ignore empty slug update when blog already has slug', async () => {
        const existingBlog = {
            _id: 'blog-id-1',
            title: 'Existing title',
            slug: 'existing-slug',
            content: '# Existing',
            save: jasmine.createSpy('save').and.callFake(async function() { return this; })
        };
        BlogMock.findById.and.returnValue(Promise.resolve(existingBlog));

        const req = {
            user: { roles: [{ name: 'provider' }] },
            params: { id: 'blog-id-1' },
            body: JSON.stringify({
                slug: '   ',
                title: 'Updated title'
            })
        };
        const res = makeResponse();

        await controller.updateById(req, res);

        expect(existingBlog.slug).toBe('existing-slug');
        expect(existingBlog.title).toBe('Updated title');
        expect(existingBlog.save).toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith({
            message: 'Blog entry patched successfully',
            patchedBlog: existingBlog
        });
    });

    it('should generate slug on patch when blog has no slug and request does not include slug', async () => {
        const existingBlog = {
            _id: 'blog-id-1',
            title: 'Legacy title',
            content: '# Existing',
            save: jasmine.createSpy('save').and.callFake(async function() { return this; })
        };
        BlogMock.findById.and.returnValue(Promise.resolve(existingBlog));

        const req = {
            user: { roles: [{ name: 'provider' }] },
            params: { id: 'blog-id-1' },
            body: JSON.stringify({
                content: '# Updated'
            })
        };
        const res = makeResponse();

        await controller.updateById(req, res);

        expect(existingBlog.slug).toBe('legacy-title');
        expect(existingBlog.content).toBe('# Updated');
        expect(existingBlog.save).toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith({
            message: 'Blog entry patched successfully',
            patchedBlog: existingBlog
        });
    });

    it('should return 400 when patch payload is not valid JSON', async () => {
        const req = {
            user: { roles: [{ name: 'provider' }] },
            params: { id: 'blog-id-1' },
            body: '{invalid-json'
        };
        const res = makeResponse();

        await controller.updateById(req, res);

        expect(BlogMock.findById).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            error: 'Invalid JSON body'
        });
    });

    it('should return 400 when patch has no editable fields', async () => {
        const req = {
            user: { roles: [{ name: 'provider' }] },
            params: { id: 'blog-id-1' },
            body: JSON.stringify({
                ignoredField: 'value'
            })
        };
        const res = makeResponse();

        await controller.updateById(req, res);

        expect(BlogMock.findById).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            error: 'No update fields provided'
        });
    });

    it('should return 404 when patch target does not exist', async () => {
        BlogMock.findById.and.returnValue(Promise.resolve(null));

        const req = {
            user: { roles: [{ name: 'provider' }] },
            params: { id: 'missing-blog' },
            body: JSON.stringify({
                title: 'Updated title'
            })
        };
        const res = makeResponse();

        await controller.updateById(req, res);

        expect(BlogMock.findById).toHaveBeenCalledWith('missing-blog');
        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({
            error: 'Blog entry not found'
        });
    });

    it('should return 409 when updated slug already exists in another blog', async () => {
        const existingBlog = {
            _id: 'blog-id-1',
            title: 'Legacy title',
            slug: 'legacy-title',
            content: '# Existing',
            save: jasmine.createSpy('save').and.callFake(async function() { return this; })
        };
        BlogMock.findById.and.returnValue(Promise.resolve(existingBlog));
        BlogMock.exists.and.returnValue(Promise.resolve({ _id: 'other-blog' }));

        const req = {
            user: { roles: [{ name: 'provider' }] },
            params: { id: 'blog-id-1' },
            body: JSON.stringify({
                slug: 'already-used'
            })
        };
        const res = makeResponse();

        await controller.updateById(req, res);

        expect(existingBlog.save).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(409);
        expect(res.json).toHaveBeenCalledWith({
            error: 'A blog entry with the same slug already exists'
        });
    });

    it('should update tags from array and trim values', async () => {
        const existingBlog = {
            _id: 'blog-id-1',
            title: 'Legacy title',
            slug: 'legacy-title',
            tags: ['old'],
            content: '# Existing',
            save: jasmine.createSpy('save').and.callFake(async function() { return this; })
        };
        BlogMock.findById.and.returnValue(Promise.resolve(existingBlog));

        const req = {
            user: { roles: [{ name: 'provider' }] },
            params: { id: 'blog-id-1' },
            body: JSON.stringify({
                tags: ['  Edge Computing  ', 'AI', '', '  ']
            })
        };
        const res = makeResponse();

        await controller.updateById(req, res);

        expect(existingBlog.tags).toEqual(['Edge Computing', 'AI']);
        expect(existingBlog.save).toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith({
            message: 'Blog entry patched successfully',
            patchedBlog: existingBlog
        });
    });

    it('should return 400 when tags contains non-string values', async () => {
        const existingBlog = {
            _id: 'blog-id-1',
            title: 'Legacy title',
            slug: 'legacy-title',
            tags: ['old'],
            content: '# Existing',
            save: jasmine.createSpy('save').and.callFake(async function() { return this; })
        };
        BlogMock.findById.and.returnValue(Promise.resolve(existingBlog));

        const req = {
            user: { roles: [{ name: 'provider' }] },
            params: { id: 'blog-id-1' },
            body: JSON.stringify({
                tags: ['AI', 42]
            })
        };
        const res = makeResponse();

        await controller.updateById(req, res);

        expect(existingBlog.save).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(jasmine.objectContaining({
            error: 'tags must be an array of strings'
        }));
    });

    it('should auto-generate and persist slug for legacy blogs in list response', async () => {
        const blogs = [{
            _id: 'blog-id-1',
            title: 'Legacy Post',
            content: '# Content',
            save: jasmine.createSpy('save').and.callFake(async function() { return this; })
        }];
        BlogMock.find.and.returnValue({
            sort: jasmine.createSpy('sort').and.returnValue(Promise.resolve(blogs))
        });

        const res = makeResponse();
        await controller.listEntries({}, res);

        expect(blogs[0].slug).toBe('legacy-post');
        expect(blogs[0].save).toHaveBeenCalled();
        const responsePayload = res.json.calls.mostRecent().args[0];
        expect(responsePayload[0].tags).toEqual([]);
    });

    it('should return 409 when slug already exists (case-insensitive)', async () => {
        BlogMock.exists.and.returnValue(Promise.resolve({ _id: 'existing-id' }));
        const req = {
            user: { roles: [{ name: 'provider' }] },
            body: JSON.stringify({
                title: 'Duplicated',
                slug: 'Duplicated-Slug',
                content: 'Body'
            })
        };
        const res = makeResponse();

        await controller.create(req, res);

        const duplicatedSlugCheckQuery = BlogMock.exists.calls.mostRecent().args[0];
        expect(duplicatedSlugCheckQuery.$or[0]).toEqual({ slugNormalized: 'duplicated-slug' });
        expect(BlogMock).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(409);
        expect(res.json).toHaveBeenCalledWith({
            error: 'A blog entry with the same slug already exists'
        });
    });

    it('should include new fields in GET /domeblog response', async () => {
        const blogs = [{
            _id: 'blog-id-1',
            title: 'Post',
            slug: 'post',
            featuredImage: 'https://example.com/image.png',
            metaDescription: 'SEO description',
            excerpt: 'Summary',
            content: '# Content',
            save: jasmine.createSpy('save')
        }];
        BlogMock.find.and.returnValue({
            sort: jasmine.createSpy('sort').and.returnValue(Promise.resolve(blogs))
        });

        const res = makeResponse();
        await controller.listEntries({}, res);

        const responsePayload = res.json.calls.mostRecent().args[0];
        expect(responsePayload[0].slug).toBe('post');
        expect(responsePayload[0].featuredImage).toBe('https://example.com/image.png');
        expect(responsePayload[0].metaDescription).toBe('SEO description');
        expect(responsePayload[0].excerpt).toBe('Summary');
        expect(responsePayload[0].tags).toEqual([]);
    });

    it('should return 500 when listing blog entries fails', async () => {
        BlogMock.find.and.returnValue({
            sort: jasmine.createSpy('sort').and.returnValue(Promise.reject(new Error('boom')))
        });

        const res = makeResponse();
        await controller.listEntries({}, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.send).toHaveBeenCalledWith('Error retrieving blog entries');
    });

    it('should include tags in GET /domeblog/:id response', async () => {
        const blog = {
            _id: 'blog-id-1',
            title: 'Post',
            slug: 'post',
            content: '# Content',
            save: jasmine.createSpy('save')
        };
        BlogMock.findById.and.returnValue(Promise.resolve(blog));

        const req = {
            params: { id: 'blog-id-1' }
        };
        const res = makeResponse();

        await controller.getById(req, res);

        const responsePayload = res.json.calls.mostRecent().args[0];
        expect(responsePayload.tags).toEqual([]);
    });

    it('should return 404 in GET /domeblog/:id when blog does not exist', async () => {
        BlogMock.findById.and.returnValue(Promise.resolve(null));

        const req = {
            params: { id: 'missing-blog' }
        };
        const res = makeResponse();

        await controller.getById(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({
            error: 'Blog entry not found'
        });
    });

    it('should return 500 in GET /domeblog/:id when retrieval fails', async () => {
        BlogMock.findById.and.returnValue(Promise.reject(new Error('boom')));

        const req = {
            params: { id: 'blog-id-1' }
        };
        const res = makeResponse();

        await controller.getById(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            error: 'Error retrieving blog entry'
        });
    });

    it('should return 403 when a non-admin tries to delete a post', async () => {
        utilsMock.hasRole.and.returnValue(false);

        const req = {
            user: { roles: [{ name: 'buyer' }] },
            params: { id: 'blog-id-1' }
        };
        const res = makeResponse();

        await controller.deleteById(req, res);

        expect(BlogMock.findByIdAndDelete).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.send).toHaveBeenCalledWith('Only administrators can delete entries');
    });

    it('should return 404 when delete target does not exist', async () => {
        BlogMock.findByIdAndDelete.and.returnValue(Promise.resolve(null));

        const req = {
            user: { roles: [{ name: 'provider' }] },
            params: { id: 'missing-blog' }
        };
        const res = makeResponse();

        await controller.deleteById(req, res);

        expect(BlogMock.findByIdAndDelete).toHaveBeenCalledWith('missing-blog');
        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({
            error: 'Blog entry not found'
        });
    });

    it('should delete a blog entry successfully', async () => {
        const deletedBlog = {
            _id: 'blog-id-1',
            title: 'Post'
        };
        BlogMock.findByIdAndDelete.and.returnValue(Promise.resolve(deletedBlog));

        const req = {
            user: { roles: [{ name: 'provider' }] },
            params: { id: 'blog-id-1' }
        };
        const res = makeResponse();

        await controller.deleteById(req, res);

        expect(BlogMock.findByIdAndDelete).toHaveBeenCalledWith('blog-id-1');
        expect(res.json).toHaveBeenCalledWith({
            message: 'Blog entry deleted successfully',
            deletedBlog
        });
    });

    it('should return 500 when delete fails', async () => {
        BlogMock.findByIdAndDelete.and.returnValue(Promise.reject(new Error('boom')));

        const req = {
            user: { roles: [{ name: 'provider' }] },
            params: { id: 'blog-id-1' }
        };
        const res = makeResponse();

        await controller.deleteById(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            error: 'Error deleting blog entry'
        });
    });

    it('should return validation errors for invalid slug format', async () => {
        const validationError = {
            name: 'ValidationError',
            errors: {
                slug: {
                    message: 'Slug must follow the format: lowercase letters/numbers separated by hyphens'
                }
            }
        };
        BlogMock = makeBlogModel({
            saveImplementation: async function() {
                throw validationError;
            }
        });
        loadController();

        const req = {
            user: { roles: [{ name: 'provider' }] },
            body: JSON.stringify({
                title: 'Invalid slug',
                slug: 'Invalid-Slug',
                content: 'Body'
            })
        };
        const res = makeResponse();

        await controller.create(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            error: 'Validation failed',
            details: ['Slug must follow the format: lowercase letters/numbers separated by hyphens']
        });
    });

    it('should return validation errors for oversized metaDescription and excerpt', async () => {
        const validationError = {
            name: 'ValidationError',
            errors: {
                metaDescription: {
                    message: 'metaDescription must be at most 160 characters long'
                },
                excerpt: {
                    message: 'excerpt must be at most 300 characters long'
                }
            }
        };
        BlogMock = makeBlogModel({
            saveImplementation: async function() {
                throw validationError;
            }
        });
        loadController();

        const req = {
            user: { roles: [{ name: 'provider' }] },
            body: JSON.stringify({
                title: 'Too long metadata',
                slug: 'too-long-metadata',
                content: 'Body'
            })
        };
        const res = makeResponse();

        await controller.create(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(jasmine.objectContaining({
            error: 'Validation failed',
            details: jasmine.arrayContaining([
                'metaDescription must be at most 160 characters long',
                'excerpt must be at most 300 characters long'
            ])
        }));
    });
});
