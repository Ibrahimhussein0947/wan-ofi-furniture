const router = require('express').Router();
const { requireAuth, optionalAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { authLimiter, publicFormLimiter } = require('../middleware/rateLimit');
const v = require('../validators/auth.validator');
const auth = require('../controllers/auth.controller');

router.post('/register', authLimiter, validate({ body: v.register }), auth.register);
router.post('/login', authLimiter, validate({ body: v.login }), auth.login);
router.post('/refresh', auth.refresh);
router.post('/logout', optionalAuth, auth.logout);
router.post('/forgot-password', publicFormLimiter, validate({ body: v.forgotPassword }), auth.forgotPassword);
router.post('/reset-password', authLimiter, validate({ body: v.resetPassword }), auth.resetPassword);
router.post('/verify-email', authLimiter, validate({ body: v.verifyEmail }), auth.verifyEmail);
router.post('/resend-verification', requireAuth, publicFormLimiter, auth.resendVerification);
router.get('/me', requireAuth, auth.me);
router.patch('/profile', requireAuth, validate({ body: v.updateProfile }), auth.updateProfile);
router.patch('/password', requireAuth, authLimiter, validate({ body: v.changePassword }), auth.changePassword);

module.exports = router;
