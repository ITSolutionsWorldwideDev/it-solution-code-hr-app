"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, History } from "lucide-react";

import { apiRequest } from "@/lib/api/client";
import type { DepartmentOption, VacancyApiRecord, VacancyRecord } from "@/lib/recruitment-types";
import { Button } from "@/components/ui/button";
import { VacancyTable } from "@/components/recruitment/vacancy-table";

const HIDDEN_VACANCY_IDS_KEY = "vacancies-hidden-view-ids";

const fallbackDepartments: DepartmentOption[] = [
  { id: 1, name: "Engineering" },
  { id: 2, name: "Product" },
  { id: 3, name: "Data" },
  { id: 4, name: "Operations" },
];

function mapVacancyToRecord(
  vacancy: VacancyApiRecord,
  departments: DepartmentOption[]
): VacancyRecord {
  const department =
    departments.find((item) => item.id === vacancy.department_id)?.name ??
    `Department ${vacancy.department_id}`;

  const parsedData = vacancy.parsed_data ?? {};
  const location =
    typeof parsedData.location === "string" && parsedData.location.trim()
      ? parsedData.location
      : "Location not set";
  const employmentType =
    typeof parsedData.employment_type === "string" && parsedData.employment_type.trim()
      ? parsedData.employment_type
      : "Full-time";

  return {
    id: String(vacancy.id),
    title: vacancy.title,
    department,
    status: vacancy.status,
    createdAt: vacancy.created_at,
    location,
    employmentType,
    experienceLevel: vacancy.experience_level ?? "not specified",
    description: vacancy.description,
    requirements: vacancy.required_skills,
    summary: vacancy.ai_summary ?? "No AI summary available yet.",
  };
}

export function VacanciesPageClient() {
  const [vacancies, setVacancies] = useState<VacancyApiRecord[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>(fallbackDepartments);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hiddenVacancyIds, setHiddenVacancyIds] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    const storedHiddenIds = window.localStorage.getItem(HIDDEN_VACANCY_IDS_KEY);
    if (!storedHiddenIds) {
      return;
    }

    try {
      const parsedIds = JSON.parse(storedHiddenIds) as string[];
      setHiddenVacancyIds(Array.isArray(parsedIds) ? parsedIds : []);
    } catch {
      window.localStorage.removeItem(HIDDEN_VACANCY_IDS_KEY);
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [vacancyResponse, departmentResponse] = await Promise.all([
          apiRequest<VacancyApiRecord[]>({ path: "/vacancies/" }),
          apiRequest<DepartmentOption[]>({ path: "/departments/" }).catch(() => fallbackDepartments),
        ]);

        setVacancies(vacancyResponse);
        setDepartments(departmentResponse.length > 0 ? departmentResponse : fallbackDepartments);
        setErrorMessage(null);
      } catch (error) {
        setVacancies([]);
        setErrorMessage(error instanceof Error ? error.message : "Failed to load vacancies.");
      }
    };

    void loadData();
  }, []);

  const items = useMemo(
    () => vacancies.map((vacancy) => mapVacancyToRecord(vacancy, departments)),
    [vacancies, departments]
  );
  const visibleItems = useMemo(
    () =>
      showHistory ? items : items.filter((item) => !hiddenVacancyIds.includes(item.id)),
    [hiddenVacancyIds, items, showHistory]
  );

  const handleClearView = () => {
    const allCurrentIds = items.map((item) => item.id);
    const nextHiddenIds = Array.from(new Set([...hiddenVacancyIds, ...allCurrentIds]));
    setHiddenVacancyIds(nextHiddenIds);
    setShowHistory(false);
    window.localStorage.setItem(HIDDEN_VACANCY_IDS_KEY, JSON.stringify(nextHiddenIds));
  };

  const handleRestoreCurrentView = () => {
    setHiddenVacancyIds([]);
    setShowHistory(false);
    window.localStorage.removeItem(HIDDEN_VACANCY_IDS_KEY);
  };

  if (errorMessage) {
    return (
      <div className="rounded-[24px] border border-[#b85b68]/35 bg-[rgba(184,91,104,0.12)] px-5 py-4 text-sm font-medium text-[#f0b6bf]">
        {errorMessage}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03)_0%,rgba(255,255,255,0.015)_100%)] px-5 py-5 text-sm text-[#95a8b8]">
        No vacancies found in the database yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end gap-3">
        <Button
          type="button"
          variant="secondary"
          icon={History}
          onClick={() => setShowHistory((current) => !current)}
        >
          {showHistory ? "Hide History" : "History"}
        </Button>

        <Button
          type="button"
          variant="secondary"
          icon={hiddenVacancyIds.length > 0 ? Eye : EyeOff}
          onClick={hiddenVacancyIds.length > 0 ? handleRestoreCurrentView : handleClearView}
        >
          {hiddenVacancyIds.length > 0 ? "Restore View" : "Clear View"}
        </Button>
      </div>

      {visibleItems.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.02)_0%,rgba(255,255,255,0.01)_100%)] px-5 py-10 text-center text-sm text-[#95a8b8]">
          {showHistory
            ? "No vacancy history is available to show right now."
            : (
              <>
                Vacancy list hidden from view. New vacancies will appear here automatically.
                Click <span className="font-semibold text-white">History</span> to see all generated vacancies or{" "}
                <span className="font-semibold text-white">Restore View</span> to bring the current list back.
              </>
            )}
        </div>
      ) : (
        <VacancyTable items={visibleItems} />
      )}
    </div>
  );
}
