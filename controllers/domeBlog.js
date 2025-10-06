const { v4: uuidv4 } = require('uuid');
const Blog = require('../db/schemas/blogModel');
const { indexes } = require('../lib/indexes');

const domeBlog = (function () {

  const create = async function (req, res) {
    try {
      blogEntry = JSON.parse(req.body)
      console.log('Returning blog entry')
      console.log(blogEntry)

      const mongoFb = {
        title: blogEntry.title,
        partyId: blogEntry.partyId,
        author: blogEntry.author,
        date: new Date().toISOString(),
        content: blogEntry.content,
      };

      // Save to MongoDB
      const blog = new Blog(mongoFb);
      await blog.save();

      // Ensure index uses a unique ID
      indexes.indexDocument('blog', uuidv4(), mongoFb);

      res.status(201).json(blog);
    } catch (err) {
      console.error(err);
      res.status(500).send('Error saving the blog entry');
    }
  };

  const listEntries = async function (req, res) {
    try {
      const blogs = await Blog.find().sort({ date: -1 });
      res.json(blogs);
    } catch (err) {
      console.error(err);
      res.status(500).send('Error retrieving blog entries');
    }
  };

  const getById = async function (req, res) {
    try {
      const { id } = req.params; // get ID from URL
      const blog = await Blog.findById(id);
  
      if (!blog) {
        return res.status(404).json({ error: 'Blog entry not found' });
      }
  
      res.json(blog);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error retrieving blog entry' });
    }
  };

  const deleteById = async function (req, res) {
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
  };

  const updateById = async function (req, res) {
    try {
        const { id } = req.params;
        const updates = JSON.parse(req.body);
    
        if (!updates || Object.keys(updates).length === 0) {
          return res.status(400).json({ error: 'No update fields provided' });
        }
    
        // Remove immutable fields
        delete updates._id;
        delete updates.__v;
    
        // Ensure $set is always an object
        const patchedBlog = await Blog.findByIdAndUpdate(
          id,
          { $set: updates }, // must be an object
          { new: true, runValidators: true }
        );
    
        if (!patchedBlog) {
          return res.status(404).json({ error: 'Blog entry not found' });
        }
    
        res.json({ message: 'Blog entry patched successfully', patchedBlog });
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error patching blog entry' });
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
