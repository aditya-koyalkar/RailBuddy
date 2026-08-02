import React from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { SearchResults } from '../components/SearchResults';
import { useAuth } from '../context/AuthContext';

export const SearchResultsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, openAuthModal } = useAuth();

  const fromCode = searchParams.get('from') || 'NDLS';
  const toCode = searchParams.get('to') || 'BCT';
  const journeyDate = searchParams.get('date') || new Date().toISOString().split('T')[0];
  const selectedClassFilter = searchParams.get('class') || 'ALL';

  const handleSelectTrainSchedule = (trainData: any) => {
    if (!user) {
      openAuthModal('signin');
      return;
    }
    // Pass train data via route state
    navigate('/select-seats', { state: { trainData } });
  };

  return (
    <SearchResults
      fromCode={fromCode}
      toCode={toCode}
      journeyDate={journeyDate}
      selectedClassFilter={selectedClassFilter}
      onSelectTrainSchedule={handleSelectTrainSchedule}
      onBack={() => navigate('/')}
    />
  );
};
