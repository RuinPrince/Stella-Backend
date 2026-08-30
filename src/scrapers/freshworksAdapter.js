const LeverAdapter = require('./LeverAdapter');

class freshworksAdapter extends LeverAdapter {
  constructor(prisma) {
    // boardToken for Freshworks on Lever is usually 'freshworks'
    super(prisma, 'freshworksAdapter', 'Freshworks', 'Private', 'freshworks');
  }
}

module.exports = freshworksAdapter;
