const mongoose = require('mongoose');

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_TAG_LENGTH = 50;

const normalizeOptionalString = function (value) {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : undefined;
};

const isValidHttpUrl = function (value) {
  if (value === undefined || value === null) {
    return true;
  }

  try {
    const parsedUrl = new URL(value);
    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
  } catch (err) {
    return false;
  }
};

const normalizeTags = function (value) {
  if (!Array.isArray(value)) {
    return value;
  }

  return value
    .map((tag) => typeof tag === 'string' ? tag.trim() : tag)
    .filter((tag) => typeof tag === 'string' && tag.length > 0);
};

const blogSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  slug: {
    type: String,
    trim: true,
    set: normalizeOptionalString,
    match: [SLUG_REGEX, 'Slug must follow the format: lowercase letters/numbers separated by hyphens']
  },
  slugNormalized: {
    type: String,
    select: false
  },
  featuredImage: {
    type: String,
    trim: true,
    set: normalizeOptionalString,
    validate: {
      validator: isValidHttpUrl,
      message: 'featuredImage must be a valid URL'
    }
  },
  metaDescription: {
    type: String,
    trim: true,
    set: normalizeOptionalString,
    maxlength: [160, 'metaDescription must be at most 160 characters long']
  },
  excerpt: {
    type: String,
    trim: true,
    set: normalizeOptionalString,
    maxlength: [300, 'excerpt must be at most 300 characters long']
  },
  author: { type: String, trim: true, set: normalizeOptionalString },
  partyId: { type: String, trim: true, set: normalizeOptionalString },
  tags: {
    type: [{
      type: String,
      trim: true,
      maxlength: [MAX_TAG_LENGTH, `each tag must be at most ${MAX_TAG_LENGTH} characters long`]
    }],
    default: [],
    set: normalizeTags
  },
  date: { type: Date, default: Date.now },
  content: { type: String, required: true, trim: true }
});

blogSchema.pre('validate', function (next) {
  if (typeof this.slug === 'string' && this.slug.length > 0) {
    this.slugNormalized = this.slug.toLowerCase();
  } else {
    this.slug = undefined;
    this.slugNormalized = undefined;
  }

  next();
});

blogSchema.index(
  { slugNormalized: 1 },
  { unique: true, partialFilterExpression: { slugNormalized: { $type: 'string' } } }
);

module.exports = mongoose.model('Blog', blogSchema);
