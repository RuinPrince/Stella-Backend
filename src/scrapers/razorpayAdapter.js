const GreenhouseAdapter = require('./GreenhouseAdapter');

class razorpayAdapter extends GreenhouseAdapter {
  constructor(prisma) {
    // boardToken for Razorpay on Greenhouse
    super(prisma, 'razorpayAdapter', 'Razorpay', 'Private', 'razorpay');
  }
}

module.exports = razorpayAdapter;
