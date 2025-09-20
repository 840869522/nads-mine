"use client";
import React, { useState, useMemo } from 'react';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Box,
  InputAdornment,
  Chip,
  Typography
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import IconButton from '@mui/material/IconButton';

interface SearchableSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ id: string; name: string; version?: string; displayName?: string }>;
  required?: boolean;
  error?: boolean;
  helperText?: string;
  placeholder?: string;
  disabled?: boolean;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({
  label,
  value,
  onChange,
  options,
  required = false,
  error = false,
  helperText,
  placeholder = "搜索...",
  disabled = false
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  // 过滤选项
  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return options;
    
    const term = searchTerm.toLowerCase();
    return options.filter(option => {
      const displayName = option.displayName || `${option.name}:${option.version || 'latest'}`;
      return displayName.toLowerCase().includes(term) || 
             option.name.toLowerCase().includes(term) ||
             (option.version && option.version.toLowerCase().includes(term));
    });
  }, [options, searchTerm]);

  // 获取当前选中项的显示名称
  const selectedOption = options.find(option => {
    const optionValue = option.version ? `${option.name}:${option.version}` : option.name;
    return optionValue === value;
  });

  const displayValue = selectedOption 
    ? (selectedOption.displayName || `${selectedOption.name}:${selectedOption.version || 'latest'}`)
    : '';

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  const handleClearSearch = () => {
    setSearchTerm('');
  };

  const handleSelectChange = (newValue: string) => {
    onChange(newValue);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleOpen = () => {
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
    setSearchTerm('');
  };

  return (
    <FormControl fullWidth required={required} error={error} disabled={disabled}>
      <InputLabel id={`${label}-label`}>{label}</InputLabel>
      <Select
        labelId={`${label}-label`}
        value={value}
        label={label}
        open={isOpen}
        onOpen={handleOpen}
        onClose={handleClose}
        displayEmpty
        renderValue={() => (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {displayValue && (
              <Chip 
                label={displayValue} 
                size="small" 
                onDelete={() => onChange('')}
                deleteIcon={<ClearIcon />}
              />
            )}
            {!displayValue && (
              <Typography color="text.secondary">
                {placeholder}
              </Typography>
            )}
          </Box>
        )}
      >
        {/* 搜索框 */}
        <Box sx={{ p: 1, borderBottom: '1px solid #e0e0e0' }}>
          <TextField
            fullWidth
            size="small"
            placeholder={placeholder}
            value={searchTerm}
            onChange={handleSearchChange}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: searchTerm && (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={handleClearSearch}>
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              )
            }}
            onClick={(e) => e.stopPropagation()}
          />
        </Box>

        {/* 选项列表 */}
        {filteredOptions.length > 0 ? (
          filteredOptions.map((option) => {
            const optionValue = option.version ? `${option.name}:${option.version}` : option.name;
            const optionDisplayName = option.displayName || `${option.name}:${option.version || 'latest'}`;
            
            return (
              <MenuItem 
                key={option.id} 
                value={optionValue}
                onClick={() => handleSelectChange(optionValue)}
              >
                <Box>
                  <Typography variant="body2" component="div">
                    {optionDisplayName}
                  </Typography>
                  {option.version && (
                    <Typography variant="caption" color="text.secondary">
                      ID: {option.id}
                    </Typography>
                  )}
                </Box>
              </MenuItem>
            );
          })
        ) : (
          <MenuItem disabled>
            <Typography color="text.secondary">
              {searchTerm ? '未找到匹配的镜像' : '暂无可用镜像'}
            </Typography>
          </MenuItem>
        )}
      </Select>
      {helperText && (
        <Typography variant="caption" color={error ? 'error' : 'text.secondary'} sx={{ mt: 0.5 }}>
          {helperText}
        </Typography>
      )}
    </FormControl>
  );
};

export default SearchableSelect;
