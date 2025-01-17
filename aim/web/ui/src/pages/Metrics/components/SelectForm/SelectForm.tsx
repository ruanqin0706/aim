import React from 'react';
import {
  Box,
  TextField,
  Checkbox,
  Divider,
  InputBase,
  Popper,
} from '@material-ui/core';
import Autocomplete from '@material-ui/lab/Autocomplete';
import {
  CheckBox as CheckBoxIcon,
  CheckBoxOutlineBlank,
  SearchOutlined,
} from '@material-ui/icons';
import { isEmpty } from 'lodash-es';

import useModel from 'hooks/model/useModel';
import { IProjectsModelState } from 'types/services/models/projects/projectsModel';
import projectsModel from 'services/models/projects/projectsModel';
import COLORS from 'config/colors/colors';
import contextToString from 'utils/contextToString';

import {
  ISelectMetricsOption,
  ISelectFormProps,
} from 'types/pages/metrics/components/SelectForm/SelectForm';
import metricAppModel from 'services/models/metrics/metricsAppModel';
import Icon from 'components/Icon/Icon';
import TagLabel from 'components/TagLabel/TagLabel';
import Button from 'components/Button/Button';

import './SelectForm.scss';

function SelectForm({
  selectedMetricsData,
  onMetricsSelectChange,
  onSelectRunQueryChange,
  onSelectAdvancedQueryChange,
  toggleSelectAdvancedMode,
  onSearchQueryCopy,
}: ISelectFormProps): React.FunctionComponentElement<React.ReactNode> {
  const projectsData = useModel<IProjectsModelState>(projectsModel);
  const [anchorEl, setAnchorEl] = React.useState<any>(null);
  const searchMetricsRef = React.useRef<any>(null);

  React.useEffect(() => {
    const paramsMetricsRequestRef = projectsModel.getParamsAndMetrics();
    paramsMetricsRequestRef.call();
    return () => {
      paramsMetricsRequestRef?.abort();
      searchMetricsRef.current?.abort();
    };
  }, []);

  function handleMetricSearch() {
    searchMetricsRef.current = metricAppModel.getMetricsData();
    searchMetricsRef.current.call();
  }

  function onSelect(event: object, value: ISelectMetricsOption[]): void {
    const lookup = value.reduce(
      (acc: { [key: string]: number }, curr: ISelectMetricsOption) => {
        acc[curr.label] = ++acc[curr.label] || 0;
        return acc;
      },
      {},
    );
    onMetricsSelectChange(value.filter((option) => lookup[option.label] === 0));
  }

  function handleDelete(field: string): void {
    let fieldData = [...selectedMetricsData?.metrics].filter(
      (opt: ISelectMetricsOption) => opt.label !== field,
    );
    onMetricsSelectChange(fieldData);
  }

  function toggleEditMode(): void {
    toggleSelectAdvancedMode();
  }

  function handleClick(event: React.ChangeEvent<any>) {
    setAnchorEl(event.currentTarget);
  }

  function handleClose(event: any, reason: any) {
    if (reason === 'toggleInput') {
      return;
    }
    if (anchorEl) {
      anchorEl.focus();
    }
    setAnchorEl(null);
  }

  const metricsOptions: ISelectMetricsOption[] = React.useMemo(() => {
    let data: ISelectMetricsOption[] = [];
    let index: number = 0;
    if (projectsData?.metrics) {
      for (let key in projectsData.metrics) {
        data.push({
          label: key,
          group: key,
          color: COLORS[0][index % COLORS[0].length],
          value: {
            metric_name: key,
            context: null,
          },
        });
        index++;

        for (let val of projectsData.metrics[key]) {
          if (!isEmpty(val)) {
            let label = contextToString(val);
            data.push({
              label: `${key} ${label}`,
              group: key,
              color: COLORS[0][index % COLORS[0].length],
              value: {
                metric_name: key,
                context: val,
              },
            });
            index++;
          }
        }
      }
    }
    return data;
  }, [projectsData]);

  function handleResetSelectForm(): void {
    onMetricsSelectChange([]);
    onSelectRunQueryChange('');
  }

  const open: boolean = !!anchorEl;
  const id = open ? 'select-metric' : undefined;
  return (
    <div className='SelectForm__container'>
      <div className='SelectForm__metrics__container'>
        <Box display='flex'>
          <Box
            width='100%'
            display='flex'
            justifyContent='space-between'
            alignItems='center'
          >
            {selectedMetricsData?.advancedMode ? (
              <div className='SelectForm__textarea'>
                <TextField
                  fullWidth
                  multiline
                  size='small'
                  spellCheck={false}
                  rows={3}
                  variant='outlined'
                  placeholder={
                    'metric.name in [“loss”, “accuracy”] and run.learning_rate > 10'
                  }
                  value={selectedMetricsData?.advancedQuery ?? ''}
                  onChange={({ target }) =>
                    onSelectAdvancedQueryChange(target.value)
                  }
                />
              </div>
            ) : (
              <>
                <Box display='flex' alignItems='center'>
                  <Button
                    variant='contained'
                    color='primary'
                    onClick={handleClick}
                    aria-describedby={id}
                  >
                    <Icon name='plus' style={{ marginRight: '0.5rem' }} />
                    Metrics
                  </Button>
                  <Popper
                    id={id}
                    open={open}
                    anchorEl={anchorEl}
                    placement='bottom-start'
                    className='SelectForm__Popper'
                  >
                    <Autocomplete
                      open
                      onClose={handleClose}
                      multiple
                      className='Autocomplete__container'
                      size='small'
                      disablePortal={true}
                      disableCloseOnSelect
                      options={metricsOptions}
                      value={selectedMetricsData?.metrics ?? ''}
                      onChange={onSelect}
                      groupBy={(option) => option.group}
                      getOptionLabel={(option) => option.label}
                      renderTags={() => null}
                      disableClearable={true}
                      ListboxProps={{
                        style: {
                          height: 400,
                        },
                      }}
                      renderInput={(params) => (
                        <InputBase
                          ref={params.InputProps.ref}
                          inputProps={params.inputProps}
                          spellCheck={false}
                          placeholder='Search'
                          autoFocus={true}
                          className='SelectForm__metric__select'
                        />
                      )}
                      renderOption={(option) => {
                        let selected: boolean =
                          !!selectedMetricsData?.metrics.find(
                            (item: ISelectMetricsOption) =>
                              item.label === option.label,
                          )?.label;
                        return (
                          <React.Fragment>
                            <Checkbox
                              color='primary'
                              icon={<CheckBoxOutlineBlank />}
                              checkedIcon={<CheckBoxIcon />}
                              checked={selected}
                              size='small'
                            />
                            <span className='SelectForm__option__label'>
                              {option.label}
                            </span>
                          </React.Fragment>
                        );
                      }}
                    />
                  </Popper>
                  <Divider
                    style={{ margin: '0 1rem' }}
                    orientation='vertical'
                    flexItem
                  />
                  {selectedMetricsData?.metrics.length === 0 && (
                    <span className='SelectForm__tags__empty'>
                      No metrics are selected
                    </span>
                  )}
                  <Box className='Metrics__SelectForm__tags ScrollBar__hidden'>
                    {selectedMetricsData?.metrics?.map(
                      (tag: ISelectMetricsOption) => {
                        return (
                          <TagLabel
                            key={tag.label}
                            color={tag.color}
                            label={tag.label}
                            onDelete={handleDelete}
                          />
                        );
                      },
                    )}
                  </Box>
                </Box>
                {selectedMetricsData?.metrics.length > 1 && (
                  <span
                    onClick={() => onMetricsSelectChange([])}
                    className='SelectForm__clearAll'
                  >
                    <Icon name='close' />
                  </span>
                )}
              </>
            )}
          </Box>
        </Box>
        {selectedMetricsData?.advancedMode ? null : (
          <div className='SelectForm__TextField'>
            <TextField
              fullWidth
              size='small'
              variant='outlined'
              spellCheck={false}
              inputProps={{ style: { height: '0.687rem' } }}
              placeholder='Filter runs, e.g. run.learning_rate > 0.0001 and run.batch_size == 32'
              value={selectedMetricsData?.query ?? ''}
              onChange={({ target }) => onSelectRunQueryChange(target.value)}
            />
          </div>
        )}
      </div>

      <div className='SelectForm__search__container'>
        <Button
          fullWidth
          color='primary'
          variant='contained'
          startIcon={<SearchOutlined />}
          className='SelectForm__search__button'
          onClick={handleMetricSearch}
        >
          Search
        </Button>
        <div className='SelectForm__search__actions'>
          <Button onClick={handleResetSelectForm} withOnlyIcon={true}>
            <Icon name='reset' />
          </Button>
          <Button
            className={selectedMetricsData?.advancedMode ? 'active' : ''}
            withOnlyIcon={true}
            onClick={toggleEditMode}
          >
            <Icon name='edit' />
          </Button>
          <Button onClick={onSearchQueryCopy} withOnlyIcon={true}>
            <Icon name='copy' />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default React.memo(SelectForm);
