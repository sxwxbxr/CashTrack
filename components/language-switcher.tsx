"use client"

import { useCallback } from "react"

import { useTranslations } from "@/components/language-provider"
import { isSupportedLanguage } from "@/lib/i18n/translations"
import { cn } from "@/lib/utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface LanguageSwitcherProps {
  className?: string
}

export function LanguageSwitcher({ className }: LanguageSwitcherProps) {
  const { language, setLanguage, t, options } = useTranslations()

  const handleChange = useCallback(
    (value: string) => {
      if (isSupportedLanguage(value)) {
        setLanguage(value)
      }
    },
    [setLanguage],
  )

  return (
    <Select value={language} onValueChange={handleChange}>
      <SelectTrigger className={cn("min-w-[8rem]", className)} aria-label={t("Language")}>
        <SelectValue placeholder={t("Language")} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
