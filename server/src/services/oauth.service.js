import { User } from '../models/User.js';

export function getGitHubAuthUrl(callbackUrl) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) throw new Error('GITHUB_CLIENT_ID is not configured');
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl,
    scope: 'read:user user:email'
  });
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

export async function exchangeGitHubCode(code, callbackUrl) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('GitHub OAuth credentials are not configured');
  }

  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: callbackUrl
    })
  });

  const tokenData = await tokenRes.json();
  if (!tokenRes.ok || !tokenData.access_token) {
    throw new Error(tokenData.error_description || 'Failed to exchange GitHub authorization code');
  }

  const accessToken = tokenData.access_token;

  const userRes = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'User-Agent': 'ClarifySQL-OAuth'
    }
  });

  if (!userRes.ok) throw new Error('Failed to retrieve GitHub user profile');
  const userData = await userRes.json();

  let email = userData.email;
  if (!email) {
    const emailsRes = await fetch('https://api.github.com/user/emails', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': 'ClarifySQL-OAuth'
      }
    });
    if (emailsRes.ok) {
      const emails = await emailsRes.json();
      const primaryEmail = emails.find((e) => e.primary && e.verified) || emails[0];
      if (primaryEmail) email = primaryEmail.email;
    }
  }

  if (!email) throw new Error('No verified email associated with this GitHub account');

  return {
    provider: 'github',
    providerId: String(userData.id),
    email: email.toLowerCase().trim(),
    name: userData.name || userData.login || 'GitHub User',
    avatarUrl: userData.avatar_url || ''
  };
}

export function getGoogleAuthUrl(callbackUrl) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error('GOOGLE_CLIENT_ID is not configured');
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline'
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeGoogleCode(code, callbackUrl) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials are not configured');
  }

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: callbackUrl
    }).toString()
  });

  const tokenData = await tokenRes.json();
  if (!tokenRes.ok || !tokenData.access_token) {
    throw new Error(tokenData.error_description || 'Failed to exchange Google authorization code');
  }

  const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` }
  });

  if (!userRes.ok) throw new Error('Failed to retrieve Google user profile');
  const userData = await userRes.json();

  if (!userData.email) throw new Error('No email returned by Google OAuth');

  return {
    provider: 'google',
    providerId: userData.sub,
    email: userData.email.toLowerCase().trim(),
    name: userData.name || userData.email.split('@')[0],
    avatarUrl: userData.picture || ''
  };
}

export async function findOrCreateOAuthUser({ provider, providerId, email, name, avatarUrl }) {
  let user = await User.findOne({ email });

  if (user) {
    let updated = false;
    if (!user.providerId) {
      user.providerId = providerId;
      updated = true;
    }
    if (!user.avatarUrl && avatarUrl) {
      user.avatarUrl = avatarUrl;
      updated = true;
    }
    if (user.authProvider === 'local') {
      user.authProvider = provider;
      updated = true;
    }
    if (updated) await user.save();
    return user;
  }

  user = await User.create({
    name: (name || 'User').slice(0, 60).trim(),
    email,
    authProvider: provider,
    providerId,
    avatarUrl
  });

  return user;
}
