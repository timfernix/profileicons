export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const iconId = url.searchParams.get('icon');

    const response = await env.ASSETS.fetch(request);

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') || !iconId) {
      return response;
    }

    const cdnImageUrl = `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/profile-icons/${iconId}.jpg`;
    
    let iconTitle = "League of Legends Profile Icon"; 

    try {
      const cache = caches.default;
      const cacheKey = new Request("https://cdragon.local/summoner-icons.json");
      
      let jsonResponse = await cache.match(cacheKey);

      if (!jsonResponse) {
        jsonResponse = await fetch('https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/summoner-icons.json');
        
        if (jsonResponse.ok) {
          const responseToCache = new Response(jsonResponse.body, jsonResponse);
          
          responseToCache.headers.set('Cache-Control', 's-maxage=86400');
          
          ctx.waitUntil(cache.put(cacheKey, responseToCache));
        }
      }

      if (jsonResponse.ok) {
        const iconsData = await jsonResponse.json();
        const iconData = iconsData.find(icon => icon.id === parseInt(iconId));
        
        if (iconData && iconData.title) {
          iconTitle = iconData.title;
        }
      }
    } catch (e) {
      console.error("Error while getting file:", e);
    }

    return new HTMLRewriter()
      .on('meta[property="og:image"]', {
        element(e) { e.setAttribute("content", cdnImageUrl); }
      })
      .on('meta[name="twitter:image"]', {
        element(e) { e.setAttribute("content", cdnImageUrl); }
      })
      .on('meta[property="og:description"]', {
        element(e) { e.setAttribute("content", iconTitle); }
      })
      .on('meta[name="twitter:description"]', {
        element(e) { e.setAttribute("content", iconTitle); }
      })
      .transform(new Response(response.body, response));
  }
};