'use client'

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Home() {
  const [news, setNews] = useState([])

  useEffect(() => {
    const fetchInitialNews = async () => {
      const { data } = await supabase
        .from('industry_news')
        .select('*')
        .gte('published_at', '2026-01-01') // <-- THE TIME GATE: Only fetch 2026 or newer
        .order('published_at', { ascending: false })
        .limit(100)
      
      if (data) setNews(data)
    }

    fetchInitialNews()

    const channel = supabase
      .channel('realtime-news')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'industry_news' }, 
        (payload) => {
          setNews((currentNews) => [payload.new, ...currentNews])
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return `${date.getDate()}. ${date.toLocaleString('en-GB', { month: 'long' })} ${date.getFullYear()}`
  }

  // --- THE ULTIMATE BOUNCER (Now with ID checks) ---
  const seenTitles = new Set();
  const seenImages = new Set();
  
  const uniqueNews = news.filter(article => {
    // 1. Double-check the year just in case a real-time update tries to sneak in
    const articleYear = new Date(article.published_at).getFullYear();
    if (articleYear < 2026) return false;

    // 2. Strip all punctuation, spaces, and make it lowercase to catch sneaky variations
    const cleanTitle = (article.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const image = article.image_url;
    
    // 3. Check if we've seen this exact image or this cleaned-up title before
    const isDuplicateTitle = seenTitles.has(cleanTitle);
    const isDuplicateImage = image && seenImages.has(image);
    
    if (isDuplicateTitle || isDuplicateImage) {
      return false; // Throw it in the trash
    }
    
    // 4. Add to our memory banks and keep the article
    seenTitles.add(cleanTitle);
    if (image) seenImages.add(image);
    return true; 
  });
  // -----------------------------

  if (uniqueNews.length === 0) return (
    <div className="min-h-screen bg-black flex items-center justify-center text-white">
      <p className="animate-pulse tracking-widest uppercase text-xs font-bold">Loading Archive...</p>
    </div>
  )

  return (
    <main className="min-h-screen bg-black p-4 md:p-12 font-sans selection:bg-black selection:text-white">
      
      <div className="max-w-[1200px] mx-auto bg-white min-h-screen text-black pb-20">
        
        <div className="p-6 md:p-10">
          <header className="flex justify-between items-end border-b border-black pb-4 mb-6 text-[10px] md:text-xs font-bold uppercase tracking-widest">
            <span>Industry Radar</span>
            <div className="hidden md:flex gap-6">
              <span className="cursor-pointer hover:underline underline-offset-4">Database</span>
              <span className="cursor-pointer hover:underline underline-offset-4">Authors</span>
              <span className="cursor-pointer hover:underline underline-offset-4">Trends</span>
            </div>
          </header>

          <h1 className="text-[14vw] md:text-[9rem] lg:text-[11.5rem] font-black tracking-tighter uppercase leading-[0.8] mb-12">
            RADAR
          </h1>

          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-8">
            <span className="text-[10px] font-bold uppercase tracking-widest">Categories</span>
            <div className="flex flex-wrap gap-2 text-[9px] font-bold uppercase tracking-wider">
              <button className="border border-black rounded-full px-4 py-1.5 hover:bg-black hover:text-white transition-colors">All</button>
              <button className="border border-black rounded-full px-4 py-1.5 hover:bg-black hover:text-white transition-colors">Film</button>
              <button className="border border-black rounded-full px-4 py-1.5 hover:bg-black hover:text-white transition-colors">Television</button>
              <button className="border border-black rounded-full px-4 py-1.5 hover:bg-black hover:text-white transition-colors">Documentary</button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 border-t border-black">
          {uniqueNews.map((article, i) => (
            <article 
              key={article.id || i} 
              className="border-b border-black md:[&:not(:nth-child(3n))]:border-r lg:[&:not(:nth-child(3n))]:border-r p-6 md:p-8 flex flex-col group hover:bg-stone-50 transition-colors duration-300"
            >
              <a href={article.url} target="_blank" rel="noopener noreferrer" className="flex flex-col h-full">
                
                <div className="flex justify-between items-center mb-6">
                  <span className="text-[10px] font-medium tracking-wide text-stone-500">
                    {formatDate(article.published_at)}
                  </span>
                  <span className="border border-stone-300 rounded-full px-3 py-1 text-[8px] font-bold uppercase tracking-widest group-hover:border-black transition-colors">
                    {article.category || 'INDUSTRY'}
                  </span>
                </div>

                {article.image_url && (
                  <div className="w-full aspect-square mb-6 bg-stone-100 overflow-hidden">
                    <img 
                      src={article.image_url} 
                      alt="Thumbnail" 
                      className="w-full h-full object-cover filter grayscale group-hover:grayscale-0 transition-all duration-700" 
                    />
                  </div>
                )}

                <h2 className="text-xl md:text-2xl font-bold tracking-tight leading-snug mb-3">
                  {article.title}
                </h2>
                <p className="text-sm text-stone-600 leading-relaxed line-clamp-4 mb-8">
                  {article.summary.replace(/<[^>]+>/g, '')}
                </p>

                <div className="mt-auto pt-4 border-t border-stone-200 flex items-center gap-4 text-[9px] font-bold uppercase tracking-widest text-stone-400 group-hover:text-black transition-colors">
                  <span>Source <span className="text-black ml-1">Feed</span></span>
                  <span>Read <span className="text-black ml-1">→</span></span>
                </div>

              </a>
            </article>
          ))}
        </div>

      </div>
    </main>
  )
}