const axios = require('axios');
const logger = require('../utils/logger');

const DAILY_API_KEY = process.env.DAILY_API_KEY;
const DAILY_API_BASE_URL = 'https://api.daily.co/v1';
const DAILY_DOMAIN = 'kartess.daily.co';

if (!DAILY_API_KEY) {
  logger.warn('DAILY_API_KEY not set - Daily.co functionality will be disabled');
}

/**
 * Daily.co API client service
 * Handles room creation, token generation, and room management
 */
class DailyService {
  constructor() {
    this.apiKey = DAILY_API_KEY;
    this.baseURL = DAILY_API_BASE_URL;
    this.domain = DAILY_DOMAIN;
  }

  /**
   * Get authorization headers for API requests
   */
  getHeaders() {
    if (!this.apiKey) {
      throw new Error('DAILY_API_KEY is not configured');
    }
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Create a Daily.co room
   * @param {Object} properties - Room properties
   * @param {string} properties.name - Room name (optional, will be generated if not provided)
   * @param {boolean} properties.owner_only_broadcast - Only owner can broadcast (for live streaming)
   * @param {boolean} properties.enable_chat - Enable chat in room
   * @param {number} properties.exp - Room expiration timestamp (Unix timestamp)
   * @param {string} properties.privacy - Room privacy ('private' or 'public')
   * @returns {Promise<Object>} Room object with url, name, and config
   */
  async createRoom(properties = {}) {
    try {
      if (!this.apiKey) {
        throw new Error('DAILY_API_KEY is not configured');
      }

      const {
        name,
        owner_only_broadcast = false,
        enable_chat = true,
        exp,
        privacy = 'private',
      } = properties;

      // Calculate expiration time (24 hours from now) if not provided
      const expirationTime = exp || Math.floor(Date.now() / 1000) + 3600 * 24;

      const roomConfig = {
        privacy,
        properties: {
          enable_chat,
          exp: expirationTime,
        },
      };

      // Add owner_only_broadcast for live streaming
      if (owner_only_broadcast) {
        roomConfig.properties.owner_only_broadcast = true;
      }

      // Add room name if provided
      if (name) {
        roomConfig.name = name;
      }

      const response = await axios.post(
        `${this.baseURL}/rooms`,
        roomConfig,
        { headers: this.getHeaders() }
      );

      logger.info('Daily.co room created', {
        roomName: response.data.name,
        url: response.data.url,
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to create Daily.co room', {
        error: error.message,
        response: error.response?.data,
      });
      throw new Error(`Failed to create Daily.co room: ${error.message}`);
    }
  }

  /**
   * Generate a meeting token for a room
   * @param {string} roomName - Room name
   * @param {Object} properties - Token properties
   * @param {boolean} properties.is_owner - User is room owner
   * @param {string} properties.user_name - User name
   * @param {number} properties.exp - Token expiration timestamp
   * @returns {Promise<string>} Meeting token
   */
  async createMeetingToken(roomName, properties = {}) {
    try {
      if (!this.apiKey) {
        throw new Error('DAILY_API_KEY is not configured');
      }

      const {
        is_owner = false,
        user_name = 'User',
        exp,
      } = properties;

      // Calculate expiration time (24 hours from now) if not provided
      const expirationTime = exp || Math.floor(Date.now() / 1000) + 3600 * 24;

      const tokenConfig = {
        properties: {
          room_name: roomName,
          is_owner,
          user_name,
          exp: expirationTime,
        },
      };

      const response = await axios.post(
        `${this.baseURL}/meeting-tokens`,
        tokenConfig,
        { headers: this.getHeaders() }
      );

      logger.info('Daily.co meeting token created', {
        roomName,
        isOwner: is_owner,
      });

      return response.data.token;
    } catch (error) {
      logger.error('Failed to create Daily.co meeting token', {
        error: error.message,
        roomName,
        response: error.response?.data,
      });
      throw new Error(`Failed to create Daily.co meeting token: ${error.message}`);
    }
  }

  /**
   * Get room details
   * @param {string} roomName - Room name
   * @returns {Promise<Object>} Room object
   */
  async getRoom(roomName) {
    try {
      if (!this.apiKey) {
        throw new Error('DAILY_API_KEY is not configured');
      }

      const response = await axios.get(
        `${this.baseURL}/rooms/${roomName}`,
        { headers: this.getHeaders() }
      );

      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        return null;
      }
      logger.error('Failed to get Daily.co room', {
        error: error.message,
        roomName,
        response: error.response?.data,
      });
      throw new Error(`Failed to get Daily.co room: ${error.message}`);
    }
  }

  /**
   * Delete/expire a room
   * @param {string} roomName - Room name
   * @returns {Promise<Object>} Deletion result
   */
  async deleteRoom(roomName) {
    try {
      if (!this.apiKey) {
        throw new Error('DAILY_API_KEY is not configured');
      }

      const response = await axios.delete(
        `${this.baseURL}/rooms/${roomName}`,
        { headers: this.getHeaders() }
      );

      logger.info('Daily.co room deleted', { roomName });

      return response.data;
    } catch (error) {
      // Room might not exist, which is fine
      if (error.response?.status === 404) {
        logger.info('Daily.co room not found (already deleted)', { roomName });
        return { deleted: true };
      }
      logger.error('Failed to delete Daily.co room', {
        error: error.message,
        roomName,
        response: error.response?.data,
      });
      throw new Error(`Failed to delete Daily.co room: ${error.message}`);
    }
  }

  /**
   * Extract room name from room URL
   * @param {string} roomUrl - Full room URL
   * @returns {string} Room name
   */
  extractRoomName(roomUrl) {
    if (!roomUrl) return null;
    // Room URL format: https://kartess.daily.co/room-name
    const match = roomUrl.match(/https?:\/\/[^/]+\/(.+)/);
    return match ? match[1] : null;
  }
}

// Export singleton instance
module.exports = new DailyService();

