import React, { useState, useEffect, useReducer, useCallback, useMemo } from 'react';
import axios from 'axios';
import './index_v3.css';

const API_BASE = "https://api.tvmaze.com";

const initialState = {
  data: [],
  episodes: [],
  detailedShow: null,
  watchlist: JSON.parse(localStorage.getItem('movieClubWatchlist_v3')) || [],
  isLoading: true,
  isError: false,
  query: localStorage.getItem('movieClubQuery_v3') || "rain",
  filters: {
    genre: "",
    language: "",
    rating: 0,
  },
  page: 1,
  pageSize: 6,
  selectedShowId: null,
};

function appReducer(state, action) {
  switch (action.type) {
    case 'FETCH_INIT':
      return { ...state, isLoading: true, isError: false };
    case 'FETCH_SUCCESS':
      return { ...state, isLoading: false, data: action.payload };
    case 'FETCH_FAILURE':
      return { ...state, isLoading: false, isError: true };
    
    case 'FETCH_DETAIL_INIT':
      return { ...state, isLoading: true, isError: false, detailedShow: null, episodes: [] };
    case 'FETCH_DETAIL_SUCCESS':
      return { 
        ...state, 
        isLoading: false, 
        detailedShow: action.payload.show,
        episodes: action.payload.episodes
      };
    
    case 'SET_QUERY':
      return { ...state, query: action.payload, page: 1 };
    case 'SET_FILTERS':
      return { ...state, filters: { ...state.filters, ...action.payload }, page: 1 };
    
    case 'ADD_WATCHLIST':
      if (state.watchlist.find(s => s.id === action.payload.id)) {
        return state;
      }
      return { ...state, watchlist: [...state.watchlist, action.payload] };
    case 'REMOVE_WATCHLIST':
      return { ...state, watchlist: state.watchlist.filter(s => s.id !== action.payload) };
    case 'CLEAR_WATCHLIST':
      return { ...state, watchlist: [] };
      
    case 'SET_PAGE':
      return { ...state, page: action.payload };
      
    case 'VIEW_DETAIL':
      return { ...state, selectedShowId: action.payload };
    case 'VIEW_HOME':
      return { ...state, selectedShowId: null, detailedShow: null, episodes: [] };
      
    default:
      throw new Error();
  }
}

const SearchIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon-search">
    <circle cx="11" cy="11" r="8"></circle>
    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
  </svg>
);

const StarIcon = ({ fill = false }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={fill ? "icon-star-filled" : "icon-star-empty"}>
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
  </svg>
);

const LoadingSpinner = () => (
  <div className="loading-spinner-container">
    <div className="loading-spinner"></div>
  </div>
);

const ErrorComponent = ({ onRetry }) => (
  <div className="message-box error-box">
    <h3>Bir şeyler ters gitti...</h3>
    <button
      onClick={onRetry}
      className="btn btn-primary"
    >
      Tekrar Dene
    </button>
  </div>
);

const EmptyComponent = () => (
  <div className="message-box empty-box">
    <h3>Aramanızla eşleşen dizi bulunamadı.</h3>
  </div>
);

function SearchBox({ onSearch, initialQuery }) {
  const [term, setTerm] = useState(initialQuery);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSearch(term);
  };

  return (
    <form onSubmit={handleSubmit} className="search-form">
      <div className="search-input-wrapper">
        <input
          type="text"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Dizi ara (ör: 'friends')"
          className="search-input"
        />
        <div className="search-icon-wrapper">
          <SearchIcon />
        </div>
      </div>
    </form>
  );
}

function Filters({ filters, onFilterChange, genres, languages }) {
  const handleSelectChange = (e) => {
    onFilterChange({ [e.target.name]: e.target.value });
  };
  
  const handleRatingChange = (e) => {
    onFilterChange({ rating: parseFloat(e.target.value) });
  };

  return (
    <div className="filters-grid">
      <select
        name="genre"
        value={filters.genre}
        onChange={handleSelectChange}
        className="select-input"
      >
        <option value="">Tüm Türler</option>
        {genres.map(g => <option key={g} value={g}>{g}</option>)}
      </select>
      <select
        name="language"
        value={filters.language}
        onChange={handleSelectChange}
        className="select-input"
      >
        <option value="">Tüm Diller</option>
        {languages.map(l => <option key={l} value={l}>{l}</option>)}
      </select>
      <div className="filter-rating">
          <label htmlFor="rating" className="rating-label">Minimum Puan: {filters.rating.toFixed(1)}</label>
          <input
           type="range"
           id="rating"
           name="rating"
           min="0"
           max="10"
           step="0.5"
           value={filters.rating}
           onChange={handleRatingChange}
           className="rating-slider"
         />
      </div>
    </div>
  );
}

function TVCard({ show, onAdd, onDetail, isInWatchlist }) {
  const summary = show.summary ? show.summary.replace(/<[^>]+>/g, '').substring(0, 100) + '...' : 'Özet mevcut değil.';
  const rating = show.rating?.average ? show.rating.average.toFixed(1) : 'N/A';
  const imageUrl = show.image?.medium || 'https://placehold.co/210x295/1f2937/9ca3af?text=Poster+Yok';

  return (
    <div className="tv-card">
      <img src={imageUrl} alt={show.name} className="card-image" />
      <div className="card-content">
        <h3 className="card-title">{show.name}</h3>
        <div className="card-rating">
          <StarIcon fill={true} />
          <span>{rating}</span>
        </div>
        <p className="card-meta">Dil: {show.language}</p>
        <p className="card-meta">Tür: {show.genres?.join(', ') || 'Bilinmiyor'}</p>
        <p className="card-summary">{summary}</p>
        <div className="card-buttons">
          <button
            onClick={() => onDetail(show.id)}
            className="btn btn-detail"
          >
            Detay
          </button>
          <button
            onClick={() => onAdd(show)}
            disabled={isInWatchlist}
            className="btn btn-add"
          >
            {isInWatchlist ? 'Listede' : 'Listeye Ekle'}
          </button>
        </div>
      </div>
    </div>
  );
}

function TVList({ shows, state, onAdd, onDetail, onRetry }) {
  const watchlistIds = useMemo(() => new Set(state.watchlist.map(s => s.id)), [state.watchlist]);

  if (state.isLoading) return <LoadingSpinner />;
  if (state.isError) return <ErrorComponent onRetry={onRetry} />;
  if (shows.length === 0) return <EmptyComponent />;

  return (
    <div className="tv-list">
      {shows.map(show => (
        <TVCard
          key={show.id}
          show={show}
          onAdd={onAdd}
          onDetail={onDetail}
          isInWatchlist={watchlistIds.has(show.id)}
        />
      ))}
    </div>
  );
}

function WatchlistPanel({ watchlist, onRemove, onClear }) {
  return (
    <div className="watchlist-panel">
      <h2 className="watchlist-title">Gösterim Listesi ({watchlist.length})</h2>
      {watchlist.length === 0 ? (
        <p>Listeniz boş.</p>
      ) : (
        <ul className="watchlist-items">
          {watchlist.map(show => (
            <li key={show.id} className="watchlist-item">
              <span className="item-name">{show.name}</span>
              <button
                onClick={() => onRemove(show.id)}
                className="btn-remove"
              >
                Kaldır
              </button>
            </li>
          ))}
        </ul>
      )}
      {watchlist.length > 0 && (
        <button
          onClick={onClear}
          className="btn btn-clear"
        >
          Listeyi Temizle
        </button>
      )}
    </div>
  );
}

function Pagination({ currentPage, totalPages, onSetPage }) {
  return (
    <div className="pagination">
      <button
        onClick={() => onSetPage(1)}
        disabled={currentPage === 1}
        className="btn btn-pagination"
      >
        İlk
      </button>
      <button
        onClick={() => onSetPage(currentPage - 1)}
        disabled={currentPage === 1}
        className="btn btn-pagination"
      >
        Geri
      </button>
      <span className="pagination-status">
        Sayfa {currentPage} / {totalPages}
      </span>
      <button
        onClick={() => onSetPage(currentPage + 1)}
        disabled={currentPage === totalPages || totalPages === 0}
        className="btn btn-pagination"
      >
        İleri
      </button>
      <button
        onClick={() => onSetPage(totalPages)}
        disabled={currentPage === totalPages || totalPages === 0}
        className="btn btn-pagination"
      >
        Son
      </button>
    </div>
  );
}

function ShowDetail({ state, onBack }) {
  const { detailedShow: show, episodes, isLoading, isError } = state;

  if (isLoading) return (
    <div className="loading-full-page"><LoadingSpinner /></div>
  );
  
  if (isError) return (
      <div className="loading-full-page">
       <ErrorComponent onRetry={() => {}} />
      </div>
  );
  
  if (!show) return null;

  const imageUrl = show.image?.original || 'https://placehold.co/600x800/1f2937/9ca3af?text=Poster+Yok';

  return (
    <div className="show-detail-container">
      <button
        onClick={onBack}
        className="btn btn-back"
      >
        &larr; Geri Dön
      </button>
      
      <div className="detail-layout">
        <div className="detail-image-col">
          <img src={imageUrl} alt={show.name} className="detail-image" />
        </div>
        
        <div className="detail-info-col">
          <h1 className="detail-title">{show.name}</h1>
          <div className="detail-rating">
            <StarIcon fill={true} />
            <span>{show.rating?.average?.toFixed(1) || 'N/A'}</span>
          </div>
          <div className="detail-genres">
            {show.genres?.map(g => (
              <span key={g} className="genre-tag">{g}</span>
            ))}
          </div>
          <p className="detail-meta">Dil: {show.language}</p>
          <p className="detail-meta">Durum: {show.status}</p>
          <p className="detail-meta">Prömiyer: {show.premiered}</p>
          
          <div className="detail-summary"
            dangerouslySetInnerHTML={{ __html: show.summary || '<p>Özet mevcut değil.</p>' }} />
        </div>
      </div>
      
      <div className="episodes-section">
        <h2 className="episodes-title">Bölümler ({episodes.length})</h2>
        <div className="episodes-list-container">
          <ul className="episodes-list">
            {episodes.map(ep => (
              <li key={ep.id} className="episode-item">
                <h4 className="episode-name">S{String(ep.season).padStart(2, '0')}E{String(ep.number).padStart(2, '0')}: {ep.name}</h4>
                <p className="episode-airdate">{ep.airdate}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
      
    </div>
  );
}

function Footer({ name }) {
  return (
    <footer className="app-footer">
      <p className="footer-text">&copy; 2025 {name}. Tüm hakları saklıdır.</p>
    </footer>
  );
}

function Home({ state, handlers, paginatedData, totalPages, genres, languages }) {
  return (
    <>
      <header className="app-header">
        <h1 className="app-title">Film Kütüphanesi</h1>
      </header>
      
      <main className="main-content">
        <div className="filters-container">
          <SearchBox onSearch={handlers.handleSearch} initialQuery={state.query} />
          <Filters 
            filters={state.filters} 
            onFilterChange={handlers.handleFilterChange}
            genres={genres}
            languages={languages}
          />
        </div>
        
        <div className="home-layout">
          <div className="list-column">
            <TVList
              shows={paginatedData}
              state={state}
              onAdd={handlers.handleAddToWatchlist}
              onDetail={handlers.handleViewDetail}
              onRetry={handlers.handleSearch}
            />
            <Pagination 
              currentPage={state.page}
              totalPages={totalPages}
              onSetPage={handlers.handleSetPage}
            />
          </div>
          
          <div className="watchlist-column">
            <WatchlistPanel
              watchlist={state.watchlist}
              onRemove={handlers.handleRemoveFromWatchlist}
              onClear={handlers.handleClearWatchlist}
            />
          </div>
        </div>
      </main>
      
      <Footer name="[Ödev 3: Adınız]" />
    </>
  );
}

export default function App() {
  const [state, dispatch] = useReducer(appReducer, initialState);

  useEffect(() => {
    localStorage.setItem('movieClubQuery_v3', state.query);
  }, [state.query]);

  useEffect(() => {
    localStorage.setItem('movieClubWatchlist_v3', JSON.stringify(state.watchlist));
  }, [state.watchlist]);

  const fetchShows = useCallback(async (query) => {
    dispatch({ type: 'FETCH_INIT' });
    try {
      const result = await axios.get(`${API_BASE}/search/shows?q=${query}`);
      const shows = result.data.map(item => item.show);
      dispatch({ type: 'FETCH_SUCCESS', payload: shows });
    } catch (error) {
      dispatch({ type: 'FETCH_FAILURE' });
    }
  }, []);

  const fetchShowDetails = useCallback(async (id) => {
    dispatch({ type: 'FETCH_DETAIL_INIT' });
    try {
      const showPromise = axios.get(`${API_BASE}/shows/${id}`);
      const episodesPromise = axios.get(`${API_BASE}/shows/${id}/episodes`);
      
      const [showResult, episodesResult] = await Promise.all([showPromise, episodesPromise]);
      
      dispatch({ 
        type: 'FETCH_DETAIL_SUCCESS', 
        payload: { show: showResult.data, episodes: episodesResult.data } 
      });
    } catch (error) {
      dispatch({ type: 'FETCH_FAILURE' });
    }
  }, []);
  
  useEffect(() => {
    fetchShows(state.query);
  }, [state.query, fetchShows]);

  useEffect(() => {
    if (state.selectedShowId) {
      fetchShowDetails(state.selectedShowId);
    }
  }, [state.selectedShowId, fetchShowDetails]);

  const handleSearch = useCallback((query) => {
    dispatch({ type: 'SET_QUERY', payload: query });
  }, []);
  
  const handleFilterChange = useCallback((filter) => {
    dispatch({ type: 'SET_FILTERS', payload: filter });
  }, []);

  const handleAddToWatchlist = useCallback((show) => {
    dispatch({ type: 'ADD_WATCHLIST', payload: show });
  }, []);
  
  const handleRemoveFromWatchlist = useCallback((id) => {
    dispatch({ type: 'REMOVE_WATCHLIST', payload: id });
  }, []);

  const handleClearWatchlist = useCallback(() => {
    dispatch({ type: 'CLEAR_WATCHLIST' });
  }, []);
  
  const handleSetPage = useCallback((page) => {
    dispatch({ type: 'SET_PAGE', payload: page });
  }, []);

  const handleViewDetail = useCallback((id) => {
    dispatch({ type: 'VIEW_DETAIL', payload: id });
  }, []);
  
  const handleViewHome = useCallback(() => {
    dispatch({ type: 'VIEW_HOME' });
  }, []);

  const { uniqueGenres, uniqueLanguages } = useMemo(() => {
    const genres = new Set();
    const languages = new Set();
    state.data.forEach(show => {
      show.genres?.forEach(g => genres.add(g));
      if (show.language) languages.add(show.language);
    });
    return { 
      uniqueGenres: [...genres].sort(), 
      uniqueLanguages: [...languages].sort() 
    };
  }, [state.data]);

  const filteredData = useMemo(() => {
    return state.data.filter(show => {
      const { genre, language, rating } = state.filters;
      const showRating = show.rating?.average || 0;
      
      const genreMatch = !genre || show.genres?.includes(genre);
      const langMatch = !language || show.language === language;
      const ratingMatch = showRating >= rating;
      
      return genreMatch && langMatch && ratingMatch;
    });
  }, [state.data, state.filters]);

  const totalPages = useMemo(() => {
    return Math.ceil(filteredData.length / state.pageSize) || 1;
  }, [filteredData, state.pageSize]);

  const paginatedData = useMemo(() => {
    const start = (state.page - 1) * state.pageSize;
    const end = start + state.pageSize;
    return filteredData.slice(start, end);
  }, [filteredData, state.page, state.pageSize]);
  
  const handlers = {
    handleSearch,
    handleFilterChange,
    handleAddToWatchlist,
    handleRemoveFromWatchlist,
    handleClearWatchlist,
    handleSetPage,
    handleViewDetail,
  };

  return (
    <div className="app-container">
      {state.selectedShowId ? (
        <ShowDetail
          state={state}
          onBack={handleViewHome}
        />
      ) : (
        <Home
          state={state}
          handlers={handlers}
          paginatedData={paginatedData}
          totalPages={totalPages}
          genres={uniqueGenres}
          languages={uniqueLanguages}
        />
      )}
    </div>
  );
}