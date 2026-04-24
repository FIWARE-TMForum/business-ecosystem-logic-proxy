const { v4: uuidv4 } = require('uuid');
const Blog = require('../db/schemas/blogModel');
const { indexes } = require('../lib/indexes');
const utils = require('../lib/utils');
const config = require('../config');

const BLOG_EDITABLE_FIELDS = ['title', 'slug', 'featuredImage', 'metaDescription', 'excerpt', 'content', 'partyId', 'author', 'tags'];

const domeBlog = (function () {
  const hasOwnProperty = function (obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
  };

  const parseRequestBody = function (body) {
    if (body === undefined || body === null || body === '') {
      return {};
    }

    if (typeof body === 'string') {
      try {
        return JSON.parse(body);
      } catch (err) {
        const parseError = new Error('Invalid JSON body');
        parseError.statusCode = 400;
        throw parseError;
      }
    }

    if (typeof body === 'object') {
      return body;
    }

    const parseError = new Error('Invalid JSON body');
    parseError.statusCode = 400;
    throw parseError;
  };

  const pickEditableFields = function (payload) {
    const blogPayload = {};

    BLOG_EDITABLE_FIELDS.forEach((field) => {
      if (hasOwnProperty(payload, field)) {
        blogPayload[field] = payload[field];
      }
    });

    return blogPayload;
  };

  const normalizeSlug = function (slug) {
    if (typeof slug !== 'string') {
      return slug;
    }

    const trimmedSlug = slug.trim();
    return trimmedSlug.length > 0 ? trimmedSlug : undefined;
  };

  const normalizeTags = function (tags) {
    if (!Array.isArray(tags)) {
      return [];
    }

    return tags
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
  };

  const parseTags = function (tags) {
    if (tags === undefined) {
      return undefined;
    }

    if (!Array.isArray(tags)) {
      const validationError = new Error('tags must be an array of strings');
      validationError.statusCode = 400;
      throw validationError;
    }

    if (!tags.every((tag) => typeof tag === 'string')) {
      const validationError = new Error('tags must be an array of strings');
      validationError.statusCode = 400;
      throw validationError;
    }

    return normalizeTags(tags);
  };

  const buildSlugBase = function (title) {
    const normalizedTitle = typeof title === 'string' ? title.toLowerCase() : '';
    const slugBase = normalizedTitle
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-');

    return slugBase.length > 0 ? slugBase : 'post';
  };

  const escapeRegex = function (value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };

  const isSlugAvailable = async function (slug, excludedId) {
    if (typeof slug !== 'string' || slug.length === 0) {
      return true;
    }

    const escapedSlug = escapeRegex(slug);
    const query = {
      $or: [
        { slugNormalized: slug.toLowerCase() },
        { slug: new RegExp(`^${escapedSlug}$`, 'i') }
      ]
    };

    if (excludedId) {
      query._id = { $ne: excludedId };
    }

    const existingBlog = await Blog.exists(query);
    return !existingBlog;
  };

  const generateUniqueSlug = async function (title, excludedId) {
    const slugBase = buildSlugBase(title);
    let slugCandidate = slugBase;
    let counter = 1;

    while (!(await isSlugAvailable(slugCandidate, excludedId))) {
      slugCandidate = `${slugBase}-${counter}`;
      counter += 1;
    }

    return slugCandidate;
  };

  const isSlugConflictError = function (err) {
    return (
      err &&
      err.code === 11000 &&
      (
        (err.keyPattern && (err.keyPattern.slugNormalized || err.keyPattern.slug)) ||
        (typeof err.message === 'string' && err.message.includes('slugNormalized'))
      )
    );
  };

  const formatValidationDetails = function (validationError) {
    return Object.keys(validationError.errors).map((fieldName) => validationError.errors[fieldName].message);
  };

  const handleControllerError = function (res, err, message) {
    if (err && err.statusCode === 400) {
      return res.status(400).json({ error: err.message });
    }

    if (isSlugConflictError(err)) {
      return res.status(409).json({ error: 'A blog entry with the same slug already exists' });
    }

    if (err && err.name === 'ValidationError') {
      return res.status(400).json({
        error: 'Validation failed',
        details: formatValidationDetails(err)
      });
    }

    console.error(err);
    return res.status(500).json({ error: message });
  };

  const ensureBlogSlug = async function (blog) {
    if (!blog || blog.slug) {
      return blog;
    }

    blog.slug = await generateUniqueSlug(blog.title, blog._id);
    await blog.save();
    return blog;
  };

  const ensureBlogTags = function (blog) {
    if (!blog) {
      return blog;
    }

    blog.tags = normalizeTags(blog.tags);
    return blog;
  };

  const create = async function (req, res) {
    if (!utils.hasRole(req.user, config.roles.admin)) {
      res.status(403).send('Only administrators can create entries');
    } else {
      try {
        const blogEntry = parseRequestBody(req.body);
        const mongoBlog = pickEditableFields(blogEntry);

        if (typeof mongoBlog.slug === 'string') {
          mongoBlog.slug = normalizeSlug(mongoBlog.slug);
        }

        if (hasOwnProperty(mongoBlog, 'tags')) {
          mongoBlog.tags = parseTags(mongoBlog.tags);
        }

        if (!mongoBlog.slug) {
          mongoBlog.slug = await generateUniqueSlug(mongoBlog.title);
        } else if (!(await isSlugAvailable(mongoBlog.slug))) {
          return res.status(409).json({ error: 'A blog entry with the same slug already exists' });
        }

        mongoBlog.date = new Date().toISOString();

        const blog = new Blog({
          ...mongoBlog
        });

        await blog.save();
        ensureBlogTags(blog);

        indexes.indexDocument('blog', uuidv4(), mongoBlog);

        res.status(201).json(blog);
      } catch (err) {
        return handleControllerError(res, err, 'Error saving the blog entry');
      }
    }
  };

  const listEntries = async function (req, res) {
    try {
      const blogs = await Blog.find().sort({ date: -1 });

      for (const blog of blogs) {
        await ensureBlogSlug(blog);
        ensureBlogTags(blog);
      }

      res.json(blogs);
    } catch (err) {
      console.error(err);
      res.status(500).send('Error retrieving blog entries');
    }
  };

  const getById = async function (req, res) {
    try {
      const { id } = req.params;
      const blog = await Blog.findById(id);
  
      if (!blog) {
        return res.status(404).json({ error: 'Blog entry not found' });
      }

      await ensureBlogSlug(blog);
      ensureBlogTags(blog);
  
      res.json(blog);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error retrieving blog entry' });
    }
  };

  const deleteById = async function (req, res) {
    if (!utils.hasRole(req.user, config.roles.admin)) {
      res.status(403).send('Only administrators can delete entries');
    } else {
      try {
        const { id } = req.params;
    
        const deletedBlog = await Blog.findByIdAndDelete(id);
    
        if (!deletedBlog) {
          return res.status(404).json({ error: 'Blog entry not found' });
        }
    
        res.json({ message: 'Blog entry deleted successfully', deletedBlog });
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error deleting blog entry' });
      }
    }
  };

  const updateById = async function (req, res) {
    if (!utils.hasRole(req.user, config.roles.admin)) {
      res.status(403).send('Only administrators can update entries');
    } else {
      try {
        const { id } = req.params;
        const payload = parseRequestBody(req.body);
        const updates = pickEditableFields(payload);

        if (hasOwnProperty(updates, 'tags')) {
          updates.tags = parseTags(updates.tags);
        }

        if (!updates || Object.keys(updates).length === 0) {
          return res.status(400).json({ error: 'No update fields provided' });
        }

        const blog = await Blog.findById(id);

        if (!blog) {
          return res.status(404).json({ error: 'Blog entry not found' });
        }

        if (hasOwnProperty(updates, 'slug')) {
          updates.slug = normalizeSlug(updates.slug);

          if (updates.slug) {
            const currentSlug = typeof blog.slug === 'string' ? blog.slug.toLowerCase() : undefined;
            const isCurrentSlug = currentSlug === updates.slug.toLowerCase();

            if (!isCurrentSlug && !(await isSlugAvailable(updates.slug, blog._id))) {
              return res.status(409).json({ error: 'A blog entry with the same slug already exists' });
            }
          } else if (!blog.slug) {
            const titleForSlug = hasOwnProperty(updates, 'title') ? updates.title : blog.title;
            updates.slug = await generateUniqueSlug(titleForSlug, blog._id);
          } else {
            delete updates.slug;
          }
        } else if (!blog.slug) {
          const titleForSlug = hasOwnProperty(updates, 'title') ? updates.title : blog.title;
          updates.slug = await generateUniqueSlug(titleForSlug, blog._id);
        }

        Object.assign(blog, updates);
        const patchedBlog = await blog.save();
        ensureBlogTags(patchedBlog);

        res.json({ message: 'Blog entry patched successfully', patchedBlog });
      } catch (err) {
        return handleControllerError(res, err, 'Error patching blog entry');
      }
    }
  };
  

  return {
    create,
    listEntries,
    getById,
    deleteById,
    updateById
  };
})();


exports.domeBlog = domeBlog;
