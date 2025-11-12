const express = require('express');
const { z } = require('zod');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const prisma = require('../prisma/client');
const authMiddleware = require('../middleware/auth');
const { createAbuseGuard } = require('../middleware/abuseDetection');
const { captchaGuard } = require('../middleware/captcha');

const router = express.Router();

// Configure Cloudinary
if (process.env.CLOUDINARY_URL) {
  const url = process.env.CLOUDINARY_URL;
  const match = url.match(/cloudinary:\/\/([^:]+):([^@]+)@(.+)/);
  if (match) {
    cloudinary.config({
      cloud_name: match[3],
      api_key: match[1],
      api_secret: match[2],
    });
  }
}

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed'), false);
    }
  },
});

// Validation schema
const createPostSchema = z.object({
  content: z.string().min(1, 'Content is required'),
  module: z.string(), // 'connect', 'visuals', 'threads', 'careernet', or comma-separated
  visibility: z.enum(['public', 'private', 'followers']).default('public'),
  network_type: z.enum(['personal', 'professional', 'both']).default('both'),
  tags: z.array(z.string()).optional(),
  is_story: z.boolean().optional().default(false),
  is_reel: z.boolean().optional().default(false),
});

/**
 * Helper function to check if a contact belongs to personal network
 */
function isPersonalNetworkContact(contact, viewerId) {
  const isViewerSender = contact.sender_id === viewerId;
  const isViewerReceiver = contact.receiver_id === viewerId;
  
  // Check if either preset is 'personal'
  if (isViewerSender && contact.sender_preset === 'personal') return true;
  if (isViewerReceiver && contact.receiver_preset === 'personal') return true;
  
  // Check if custom preset includes personal fields
  if (contact.sender_preset === 'custom' || contact.receiver_preset === 'custom') {
    const sharedData = contact.shared_data || {};
    // Personal fields: email, phone, bio, handles
    if (sharedData.email || sharedData.phone || sharedData.bio || sharedData.handles) {
      if (isViewerSender && contact.sender_preset === 'custom') return true;
      if (isViewerReceiver && contact.receiver_preset === 'custom') return true;
    }
  }
  
  return false;
}

/**
 * Helper function to check if a contact belongs to professional network
 */
function isProfessionalNetworkContact(contact, viewerId) {
  const isViewerSender = contact.sender_id === viewerId;
  const isViewerReceiver = contact.receiver_id === viewerId;
  
  // Check if either preset is 'professional'
  if (isViewerSender && contact.sender_preset === 'professional') return true;
  if (isViewerReceiver && contact.receiver_preset === 'professional') return true;
  
  // Check if custom preset includes professional fields
  if (contact.sender_preset === 'custom' || contact.receiver_preset === 'custom') {
    const sharedData = contact.shared_data || {};
    // Professional fields: company, position, education
    if (sharedData.company || sharedData.position || sharedData.education) {
      if (isViewerSender && contact.sender_preset === 'custom') return true;
      if (isViewerReceiver && contact.receiver_preset === 'custom') return true;
    }
  }
  
  return false;
}

/**
 * Helper function to filter user IDs by network type based on contacts
 */
function filterUsersByNetworkType(contacts, viewerId, networkType) {
  if (networkType === 'both') {
    // Public posts visible to all approved contacts
    return contacts.map((c) => c.sender_id === viewerId ? c.receiver_id : c.sender_id);
  }
  
  if (networkType === 'personal') {
    return contacts
      .filter((c) => isPersonalNetworkContact(c, viewerId))
      .map((c) => c.sender_id === viewerId ? c.receiver_id : c.sender_id);
  }
  
  if (networkType === 'professional') {
    return contacts
      .filter((c) => isProfessionalNetworkContact(c, viewerId))
      .map((c) => c.sender_id === viewerId ? c.receiver_id : c.sender_id);
  }
  
  return [];
}

const postCaptchaGuard = captchaGuard({ context: 'posts:create' });

const postAbuseGuard = createAbuseGuard({
  bucket: 'posts',
  minIntervalMs: 2000,
});

/**
 * POST /api/posts
 * Create a new post
 */
router.post(
  '/',
  authMiddleware,
  upload.array('media', 10),
  postCaptchaGuard,
  postAbuseGuard,
  async (req, res) => {
    try {
      // Upload media files to Cloudinary with enhanced validation
      let mediaUrls = [];
      if (req.files && req.files.length > 0) {
        const { validateFileSignature, validateFileSize } = require('../middleware/fileValidation');
        
        const uploadPromises = req.files.map(async (file) => {
          // Validate file size
          const sizeCheck = validateFileSize(file.size, 10 * 1024 * 1024);
          if (!sizeCheck.valid) {
            throw new Error(sizeCheck.error);
          }

          // Validate file signature (magic bytes)
          const allowedTypes = file.mimetype.startsWith('video/') 
            ? ['video/mp4', 'video/webm', 'video/quicktime']
            : ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
          
          const signatureCheck = await validateFileSignature(file.buffer, allowedTypes);
          if (!signatureCheck.valid) {
            throw new Error(signatureCheck.error);
          }

          // Upload to Cloudinary
          return new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
              {
                folder: 'kartess/posts',
                resource_type: file.mimetype.startsWith('video/') ? 'video' : 'image',
              },
              (error, result) => {
                if (error) reject(error);
                else resolve(result.secure_url);
              }
            );

            uploadStream.end(file.buffer);
          });
        });

        mediaUrls = await Promise.all(uploadPromises);
      }

      // Validate and parse request body
      const body = {
        ...req.body,
        tags: req.body.tags ? JSON.parse(req.body.tags) : undefined,
        is_story: req.body.is_story === 'true' || req.body.is_story === true,
        is_reel: req.body.is_reel === 'true' || req.body.is_reel === true,
      };
      const validatedData = createPostSchema.parse(body);

      // Normalize module list (trim, dedupe, lower-case)
      let moduleList = validatedData.module
        .split(',')
        .map((mod) => mod.trim().toLowerCase())
        .filter(Boolean);

      if (moduleList.length === 0) {
        return res.status(400).json({ error: 'At least one module must be selected' });
      }

      moduleList = [...new Set(moduleList)];

      // Reels must belong exclusively to visuals module
      if (validatedData.is_reel) {
        moduleList = ['visuals'];
      }

      const moduleString = moduleList.join(',');

      // Enforce 280 character limit for threads module
      if (moduleList.includes('threads') && validatedData.content.length > 280) {
        return res.status(400).json({ error: 'Thread posts must be 280 characters or less' });
      }

      // Create post
      const post = await prisma.post.create({
        data: {
          user_id: req.user.id,
          content: validatedData.content,
          module: moduleString,
          visibility: validatedData.visibility,
          network_type: validatedData.network_type || 'both',
          media_urls: mediaUrls.length > 0 ? mediaUrls : undefined,
          tags: validatedData.tags || undefined,
          is_story: validatedData.is_story,
          is_reel: validatedData.is_reel,
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              full_name: true,
              profile: {
                select: {
                  avatar_url: true,
                },
              },
            },
          },
          _count: {
            select: {
              reactions: true,
              comments: true,
            },
          },
        },
      });

      // Emit new post via Socket.io
      const io = req.app.get('io');
      if (io) {
        io.to('posts').emit('post.new', post);
      }

      res.status(201).json(post);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation error',
          details: error.errors,
        });
      }

      console.error('Post creation error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * GET /api/posts/timeline
 * Get unified timeline of posts
 */
router.get('/timeline', authMiddleware, async (req, res) => {
  try {
    const { module, sort = 'chrono', cursor, limit = 20 } = req.query;

    // Get user's approved contacts with presets for network type filtering
    const contacts = await prisma.contact.findMany({
      where: {
        OR: [
          { sender_id: req.user.id, status: 'approved' },
          { receiver_id: req.user.id, status: 'approved' },
        ],
      },
    });

    // Filter posts based on network_type
    const personalNetworkUserIds = filterUsersByNetworkType(contacts, req.user.id, 'personal');
    const professionalNetworkUserIds = filterUsersByNetworkType(contacts, req.user.id, 'professional');
    const bothNetworkUserIds = filterUsersByNetworkType(contacts, req.user.id, 'both');

    // Build where clause with network_type filtering
    const where = {
      is_story: false, // Exclude stories from timeline
      is_reel: false, // Exclude reels from timeline
      OR: [
        // Own posts always visible
        { user_id: req.user.id },
        // Public posts (network_type: 'both') visible to all approved contacts
        {
          AND: [
            { visibility: 'public' },
            { network_type: 'both' },
            { user_id: { in: bothNetworkUserIds } },
          ],
        },
        // Personal network posts visible to personal contacts
        {
          AND: [
            { network_type: 'personal' },
            {
              OR: [
                { visibility: 'public' },
                {
                  visibility: 'followers',
                  user_id: { in: personalNetworkUserIds },
                },
              ],
            },
            { user_id: { in: personalNetworkUserIds } },
          ],
        },
        // Professional network posts visible to professional contacts
        {
          AND: [
            { network_type: 'professional' },
            {
              OR: [
                { visibility: 'public' },
                {
                  visibility: 'followers',
                  user_id: { in: professionalNetworkUserIds },
                },
              ],
            },
            { user_id: { in: professionalNetworkUserIds } },
          ],
        },
        // Posts with network_type 'both' (public) - visible to all approved contacts
        {
          AND: [
            { network_type: 'both' },
            {
              OR: [
                { visibility: 'public' },
                {
                  visibility: 'followers',
                  user_id: { in: bothNetworkUserIds },
                },
              ],
            },
          ],
        },
      ],
    };

    // Filter by module if specified
    if (module && module !== 'all') {
      where.AND = [
        {
          OR: [
            { module: { equals: module } },
            { module: { contains: module } },
          ],
        },
      ];
    }

    // Build orderBy clause
    let orderBy = { created_at: 'desc' };
    if (sort === 'algorithmic') {
      // Simple engagement-based: order by reactions + comments count
      orderBy = { created_at: 'desc' };
    }

    // Get posts
    const posts = await prisma.post.findMany({
      where,
      take: parseInt(limit),
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            full_name: true,
            profile: {
              select: {
                avatar_url: true,
              },
            },
          },
        },
        parent: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                full_name: true,
                profile: {
                  select: {
                    avatar_url: true,
                  },
                },
              },
            },
            _count: {
              select: {
                reactions: true,
                comments: true,
              },
            },
          },
        },
        _count: {
          select: {
            reactions: true,
            comments: true,
          },
        },
        reactions: {
          where: {
            user_id: req.user.id,
          },
          select: {
            type: true,
          },
        },
      },
    });

    res.json({
      posts,
      nextCursor: posts.length === parseInt(limit) ? posts[posts.length - 1].id : null,
    });
  } catch (error) {
    console.error('Timeline error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/posts/module/:module
 * Get posts for a specific module (for Connect/Visuals feeds)
 */
router.get('/module/:module', authMiddleware, async (req, res) => {
  try {
    const { module } = req.params;
    const { cursor, limit = 20 } = req.query;

    // Get user's approved contacts with presets for network type filtering
    const contacts = await prisma.contact.findMany({
      where: {
        OR: [
          { sender_id: req.user.id, status: 'approved' },
          { receiver_id: req.user.id, status: 'approved' },
        ],
      },
    });

    // Filter posts based on network_type
    const personalNetworkUserIds = filterUsersByNetworkType(contacts, req.user.id, 'personal');
    const professionalNetworkUserIds = filterUsersByNetworkType(contacts, req.user.id, 'professional');
    const bothNetworkUserIds = filterUsersByNetworkType(contacts, req.user.id, 'both');

    // Build where clause - filter by module and network type
    const where = {
      is_story: false,
      ...(module === 'visuals' ? {} : { is_reel: false }), // Only visuals feed may include reels
      AND: [
        {
          OR: [
            { module: { equals: module } },
            { module: { contains: module } },
          ],
        },
        {
          OR: [
            // Own posts always visible
            { user_id: req.user.id },
            // Public posts (network_type: 'both') visible to all approved contacts
            {
              AND: [
                { visibility: 'public' },
                { network_type: 'both' },
                { user_id: { in: bothNetworkUserIds } },
              ],
            },
            // Personal network posts visible to personal contacts
            {
              AND: [
                { network_type: 'personal' },
                {
                  OR: [
                    { visibility: 'public' },
                    {
                      visibility: 'followers',
                      user_id: { in: personalNetworkUserIds },
                    },
                  ],
                },
                { user_id: { in: personalNetworkUserIds } },
              ],
            },
            // Professional network posts visible to professional contacts
            {
              AND: [
                { network_type: 'professional' },
                {
                  OR: [
                    { visibility: 'public' },
                    {
                      visibility: 'followers',
                      user_id: { in: professionalNetworkUserIds },
                    },
                  ],
                },
                { user_id: { in: professionalNetworkUserIds } },
              ],
            },
            // Posts with network_type 'both' (public) - visible to all approved contacts
            {
              AND: [
                { network_type: 'both' },
                {
                  OR: [
                    { visibility: 'public' },
                    {
                      visibility: 'followers',
                      user_id: { in: bothNetworkUserIds },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    const posts = await prisma.post.findMany({
      where,
      take: parseInt(limit),
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { created_at: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            full_name: true,
            profile: {
              select: {
                avatar_url: true,
              },
            },
          },
        },
        parent: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                full_name: true,
                profile: {
                  select: {
                    avatar_url: true,
                  },
                },
              },
            },
            _count: {
              select: {
                reactions: true,
                comments: true,
              },
            },
          },
        },
        _count: {
          select: {
            reactions: true,
            comments: true,
          },
        },
        reactions: {
          where: {
            user_id: req.user.id,
          },
          select: {
            type: true,
          },
        },
      },
    });

    res.json({
      posts,
      nextCursor: posts.length === parseInt(limit) ? posts[posts.length - 1].id : null,
    });
  } catch (error) {
    console.error('Module posts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/posts/user/:userId
 * Get posts by a specific user
 */
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { module, limit = 20, cursor } = req.query;

    // If authenticated, check network type filtering
    let viewerId = null;
    let contacts = [];
    if (req.headers.authorization) {
      try {
        const { verifyToken } = require('../utils/jwt');
        const token = req.headers.authorization.replace('Bearer ', '');
        const decoded = verifyToken(token);
        viewerId = decoded.id;

        // Get viewer's contacts with presets
        contacts = await prisma.contact.findMany({
          where: {
            OR: [
              { sender_id: viewerId, receiver_id: userId, status: 'approved' },
              { sender_id: userId, receiver_id: viewerId, status: 'approved' },
            ],
          },
        });
      } catch (error) {
        // Not authenticated or invalid token, continue as public
      }
    }

    // Build where clause
    const where = {
      user_id: userId,
      is_story: false,
    };

    // If viewer is authenticated and has contact relationship, filter by network type
    if (viewerId && contacts.length > 0) {
      const contact = contacts[0];
      const personalNetworkContact = isPersonalNetworkContact(contact, viewerId);
      const professionalNetworkContact = isProfessionalNetworkContact(contact, viewerId);

      where.OR = [
        // Own posts always visible
        { user_id: viewerId },
        // Public posts (network_type: 'both') visible to all contacts
        {
          AND: [
            { network_type: 'both' },
            { visibility: 'public' },
          ],
        },
        // Personal network posts visible if contact is personal
        ...(personalNetworkContact ? [{
          AND: [
            { network_type: 'personal' },
            { visibility: 'public' },
          ],
        }] : []),
        // Professional network posts visible if contact is professional
        ...(professionalNetworkContact ? [{
          AND: [
            { network_type: 'professional' },
            { visibility: 'public' },
          ],
        }] : []),
        // Posts with network_type 'both' (public) - visible to all contacts
        {
          AND: [
            { network_type: 'both' },
            { visibility: 'public' },
          ],
        },
      ];
    } else {
      // Public posts only for non-authenticated or no contact relationship
      where.visibility = 'public';
    }

    if (module && module !== 'all') {
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { module: { equals: module } },
            { module: { contains: module } },
          ],
        },
      ];
    }

    const posts = await prisma.post.findMany({
      where,
      take: parseInt(limit),
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { created_at: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            full_name: true,
            profile: {
              select: {
                avatar_url: true,
              },
            },
          },
        },
        _count: {
          select: {
            reactions: true,
            comments: true,
          },
        },
        reactions: req.user ? {
          where: {
            user_id: req.user.id,
          },
          select: {
            type: true,
          },
        } : false,
      },
    });

    res.json({
      posts,
      nextCursor: posts.length === parseInt(limit) ? posts[posts.length - 1].id : null,
    });
  } catch (error) {
    console.error('User posts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/posts/:postId
 * Get a single post by ID
 */
router.get('/:postId', async (req, res) => {
  try {
    const { postId } = req.params;

    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            full_name: true,
            profile: {
              select: {
                avatar_url: true,
              },
            },
          },
        },
        _count: {
          select: {
            reactions: true,
            comments: true,
          },
        },
      },
    });

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    res.json(post);
  } catch (error) {
    console.error('Get post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/posts/:postId
 * Delete a post (owners or admins only)
 */
router.delete('/:postId', authMiddleware, async (req, res) => {
  try {
    const { postId } = req.params;

    const post = await prisma.post.findUnique({
      where: { id: postId },
    });

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const isOwner = post.user_id === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Not authorized to delete this post' });
    }

    await prisma.post.delete({
      where: { id: postId },
    });

    const io = req.app.get('io');
    if (io) {
      io.to('posts').emit('post.deleted', {
        id: postId,
        user_id: post.user_id,
      });
    }

    res.json({ message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/posts/:postId/repost
 * Repost/share a post
 */
router.post('/:postId/repost', authMiddleware, async (req, res) => {
  try {
    const { postId } = req.params;
    const { content, module } = req.body;

    const originalPost = await prisma.post.findUnique({
      where: { id: postId },
    });

    if (!originalPost) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Create repost with parent_id
    // For reposts, we don't copy media_urls to the repost itself
    // Instead, we reference the parent post which contains the original content
    const repost = await prisma.post.create({
      data: {
        user_id: req.user.id,
        content: content || '', // Optional comment from reposter
        module: module || originalPost.module,
        visibility: 'public',
        network_type: originalPost.network_type || 'both',
        parent_id: postId,
        // Don't copy media_urls - they're in the parent post
        tags: originalPost.tags,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            full_name: true,
            profile: {
              select: {
                avatar_url: true,
              },
            },
          },
        },
        parent: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                full_name: true,
                profile: {
                  select: {
                    avatar_url: true,
                  },
                },
              },
            },
            _count: {
              select: {
                reactions: true,
                comments: true,
              },
            },
          },
        },
        _count: {
          select: {
            reactions: true,
            comments: true,
          },
        },
      },
    });

    // Emit via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.to('posts').emit('post.new', repost);
    }

    res.status(201).json(repost);
  } catch (error) {
    console.error('Repost error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/posts/:postId
 * Delete a post (owner or admin only)
 */
router.delete('/:postId', authMiddleware, async (req, res) => {
  try {
    const { postId } = req.params;

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: {
        id: true,
        user_id: true,
        media_urls: true,
      },
    });

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const isOwner = post.user_id === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Not authorized to delete this post' });
    }

    await prisma.post.delete({
      where: { id: postId },
    });

    const io = req.app.get('io');
    if (io) {
      io.to('posts').emit('post.deleted', { id: postId });
    }

    res.json({ message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/posts/reels
 * Get reels feed (posts where is_reel = true)
 */
router.get('/reels', authMiddleware, async (req, res) => {
  try {
    const { cursor, limit = 20 } = req.query;

    // Get user's approved contacts for network type filtering
    const contacts = await prisma.contact.findMany({
      where: {
        OR: [
          { sender_id: req.user.id, status: 'approved' },
          { receiver_id: req.user.id, status: 'approved' },
        ],
      },
    });

    // Filter posts based on network_type
    const personalNetworkUserIds = filterUsersByNetworkType(contacts, req.user.id, 'personal');
    const professionalNetworkUserIds = filterUsersByNetworkType(contacts, req.user.id, 'professional');
    const bothNetworkUserIds = filterUsersByNetworkType(contacts, req.user.id, 'both');

    // Build where clause - only reels
    const where = {
      is_reel: true,
      module: { contains: 'visuals' }, // Reels belong to visuals module
      OR: [
        // Own posts always visible
        { user_id: req.user.id },
        // Public posts (network_type: 'both') visible to all approved contacts
        {
          AND: [
            { visibility: 'public' },
            { network_type: 'both' },
            { user_id: { in: bothNetworkUserIds } },
          ],
        },
        // Personal network posts visible to personal contacts
        {
          AND: [
            { network_type: 'personal' },
            {
              OR: [
                { visibility: 'public' },
                {
                  visibility: 'followers',
                  user_id: { in: personalNetworkUserIds },
                },
              ],
            },
            { user_id: { in: personalNetworkUserIds } },
          ],
        },
        // Professional network posts visible to professional contacts
        {
          AND: [
            { network_type: 'professional' },
            {
              OR: [
                { visibility: 'public' },
                {
                  visibility: 'followers',
                  user_id: { in: professionalNetworkUserIds },
                },
              ],
            },
            { user_id: { in: professionalNetworkUserIds } },
          ],
        },
      ],
    };

    const posts = await prisma.post.findMany({
      where,
      take: parseInt(limit),
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { created_at: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            full_name: true,
            profile: {
              select: {
                avatar_url: true,
              },
            },
          },
        },
        parent: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                full_name: true,
                profile: {
                  select: {
                    avatar_url: true,
                  },
                },
              },
            },
            _count: {
              select: {
                reactions: true,
                comments: true,
              },
            },
          },
        },
        _count: {
          select: {
            reactions: true,
            comments: true,
          },
        },
        reactions: {
          where: {
            user_id: req.user.id,
          },
          select: {
            type: true,
          },
        },
      },
    });

    res.json({
      posts,
      nextCursor: posts.length === parseInt(limit) ? posts[posts.length - 1].id : null,
    });
  } catch (error) {
    console.error('Reels error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;