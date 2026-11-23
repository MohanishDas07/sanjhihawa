"use client";

import React, { useState, useEffect, useRef } from "react";
import { searchCities } from "@/lib/api";
import { GeocodeItem } from "@/types/api";
import { useTranslation } from "@/lib/i18n";

interface CitySearchComboboxProps {
  currentCity: string;
  onSelectCity: (item: GeocodeItem) => void;
}

export function CitySearchCombobox({ currentCity, onSelectCity }: CitySearchComboboxProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GeocodeItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced geocoding search
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await searchCities(searchQuery);
        setSearchResults(res.results || []);
        setShowDropdown(true);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSelect = (item: GeocodeItem) => {
    onSelectCity(item);
    setSearchQuery("");
    setShowDropdown(false);
  };

  return (
    <div ref={searchContainerRef} className="relative">
      <div className="flex items-center">
        <label htmlFor="city-search-input" className="sr-only">
          {t("landing.search_placeholder")}
        </label>
        <input
          id="city-search-input"
          type="text"
          role="combobox"
          aria-expanded={showDropdown}
          aria-haspopup="listbox"
          aria-controls="city-search-listbox"
          aria-autocomplete="list"
          placeholder={t("landing.search_placeholder")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => {
            if (searchResults.length > 0) setShowDropdown(true);
          }}
          className="font-mono text-xs md:text-sm px-3 py-2 border border-rule bg-paper text-ink focus:outline-none focus:ring-1 focus:ring-ink w-48 md:w-56"
        />
        {isSearching && (
          <span className="absolute right-2.5 font-mono text-xs text-ink-muted animate-pulse" aria-hidden="true">
            ...
          </span>
        )}
      </div>

      {showDropdown && (
        <ul
          id="city-search-listbox"
          role="listbox"
          aria-label="City search results"
          className="absolute left-0 top-full mt-1 w-72 bg-paper border border-rule shadow-md z-30 max-h-56 overflow-y-auto"
        >
          {searchResults.length > 0 ? (
            searchResults.map((item, idx) => (
              <li
                key={`${item.name}-${idx}`}
                role="option"
                aria-selected={item.name.toLowerCase() === currentCity.toLowerCase()}
              >
                <button
                  type="button"
                  onClick={() => handleSelect(item)}
                  className="w-full text-left px-3.5 py-2.5 text-xs md:text-sm font-sans hover:bg-surface border-b hairline border-rule last:border-0 flex flex-col"
                >
                  <span className="font-semibold text-ink">{item.name}</span>
                  <span className="text-2xs font-mono text-ink-muted">
                    {item.admin1 ? `${item.admin1}, ` : ""}
                    {item.country} ({item.latitude.toFixed(2)}°, {item.longitude.toFixed(2)}°)
                  </span>
                </button>
              </li>
            ))
          ) : (
            <li className="p-3.5 text-xs md:text-sm font-sans text-ink-muted" role="status">
              No matching place found in India.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
