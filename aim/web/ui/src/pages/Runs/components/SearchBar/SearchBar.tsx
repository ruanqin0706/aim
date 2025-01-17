import React from 'react';
import './SearchBar.scss';
import searchImg from 'assets/icons/search.svg';
import { Divider, TextField } from '@material-ui/core';
import Button from 'components/Button/Button';
import SearchIcon from '@material-ui/icons/Search';
import runAppModel from 'services/models/runs/runsAppModel';

function SearchBar({
  isRunsDataLoading,
  searchValue,
  onSearchInputChange,
  updateSelectStateUrl,
}: any) {
  const searchRunsRef = React.useRef<any>(null);

  React.useEffect(() => {
    return () => {
      searchRunsRef.current?.abort();
    };
  }, []);

  function handleRunSearch() {
    searchRunsRef.current = runAppModel.getRunsData();
    searchRunsRef.current.call().catch();
    updateSelectStateUrl();
  }

  return (
    <div className='Runs_Search_Bar'>
      <TextField
        fullWidth
        size='small'
        placeholder='Filter runs, e.g. run.learning_rate > 0.0001 and run.creation_time >= 1632081600'
        variant='outlined'
        spellCheck={false}
        InputProps={{
          startAdornment: (
            <img src={searchImg} alt='visible' style={{ marginRight: 10 }} />
          ),
          onKeyPress: (event) => {
            if (event.key === 'Enter') {
              handleRunSearch();
            }
          },
          disabled: isRunsDataLoading,
          style: { height: '1.845rem' },
        }}
        onChange={({ target }) => onSearchInputChange(target.value)}
        value={searchValue || ''}
      />
      <Divider style={{ margin: '0 1em' }} orientation='vertical' flexItem />
      <Button
        className='Runs_Search_Bar__Button'
        color='primary'
        onClick={handleRunSearch}
        variant='contained'
        size='small'
        startIcon={<SearchIcon color='inherit' />}
        disabled={isRunsDataLoading}
      >
        Search
      </Button>
    </div>
  );
}

export default SearchBar;
