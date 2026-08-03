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

    const scheduleId = trainData.scheduleId || 'default';
    const fromSeq = trainData.from?.sequence || trainData.fromSeq || 1;
    const toSeq = trainData.to?.sequence || trainData.toSeq || 2;
    const selectedClass = trainData.selectedClass || '';
    const fareAmount = trainData.fareAmount || 0;

    const queryParams = new URLSearchParams({
      fromSeq: String(fromSeq),
      toSeq: String(toSeq),
      ...(selectedClass ? { class: selectedClass } : {}),
      ...(fareAmount ? { fare: String(fareAmount) } : {}),
      fromCode: trainData.from?.code || fromCode,
      toCode: trainData.to?.code || toCode,
      trainName: trainData.trainName || trainData.name || '',
      trainNumber: trainData.trainNumber || '',
    }).toString();

    navigate(`/select-seats/${scheduleId}?${queryParams}`, { state: { trainData } });
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
