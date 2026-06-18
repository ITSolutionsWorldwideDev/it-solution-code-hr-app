"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, History, Trash2 } from "lucide-react";

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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedVacancyIds, setSelectedVacancyIds] = useState<string[]>([]);

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

  const handleDeleteSelectedVacancies = async () => {
    if (selectedVacancyIds.length === 0) {
      return;
    }

    setDeleteLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await Promise.all(
        selectedVacancyIds.map((vacancyId) =>
          apiRequest({
            path: `/vacancies/${vacancyId}`,
            method: "DELETE",
          }),
        ),
      );
      setVacancies((current) => current.filter((vacancy) => !selectedVacancyIds.includes(String(vacancy.id))));
      setHiddenVacancyIds([]);
      setShowHistory(false);
      setShowDeleteConfirm(false);
      setSelectedVacancyIds([]);
      window.localStorage.removeItem(HIDDEN_VACANCY_IDS_KEY);
      setSuccessMessage(
        `${selectedVacancyIds.length} ${selectedVacancyIds.length === 1 ? "vacancy was" : "vacancies were"} deleted from the database.`,
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to delete vacancies.");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleToggleVacancySelect = (vacancyId: string, checked: boolean) => {
    setSelectedVacancyIds((current) =>
      checked ? [...new Set([...current, vacancyId])] : current.filter((id) => id !== vacancyId),
    );
  };

  const handleToggleAllVisible = (checked: boolean) => {
    if (!checked) {
      const visibleIds = new Set(visibleItems.map((item) => item.id));
      setSelectedVacancyIds((current) => current.filter((id) => !visibleIds.has(id)));
      return;
    }

    setSelectedVacancyIds((current) => [...new Set([...current, ...visibleItems.map((item) => item.id)])]);
  };

  if (errorMessage) {
    return (
      <div className="rounded-[24px] border border-[#b85b68]/35 bg-[rgba(184,91,104,0.12)] px-5 py-4 text-sm font-medium text-[#f0b6bf]">
        {errorMessage}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end gap-3">
        <Button
          type="button"
          variant="secondary"
          icon={Trash2}
          onClick={() => setShowDeleteConfirm((current) => !current)}
          disabled={visibleItems.length === 0}
          className="border-[#5a2934] text-[#ffb9c7] hover:border-[#7a3545] hover:bg-[#24131a]"
        >
          Delete Selected
        </Button>

        <Button
          type="button"
          variant="secondary"
          icon={History}
          onClick={() => setShowHistory((current) => !current)}
          disabled={hiddenVacancyIds.length === 0}
        >
          {showHistory ? "Hide Hidden" : "Show Hidden"}
        </Button>

        <Button
          type="button"
          variant="secondary"
          icon={hiddenVacancyIds.length > 0 ? Eye : EyeOff}
          onClick={hiddenVacancyIds.length > 0 ? handleRestoreCurrentView : handleClearView}
        >
          {hiddenVacancyIds.length > 0 ? "Restore List" : "Hide Current List"}
        </Button>
      </div>

      {showDeleteConfirm ? (
        <div className="rounded-[24px] border border-[#6b3041] bg-[rgba(107,48,65,0.18)] px-5 py-5 text-[#ffd3db]">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#ffb9c7]">
            Delete selected vacancies?
          </p>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[#ffd3db]">
            This temporary action will delete only the selected vacancies from the database, including related vacancy
            pipeline data such as applications, shortlist records, interview links, parse jobs, and match records.
            Candidate profiles are not deleted.
          </p>
          <p className="mt-3 text-sm text-[#ffdde3]">
            Selected: <span className="font-semibold text-white">{selectedVacancyIds.length}</span>
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={deleteLoading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              icon={Trash2}
              loading={deleteLoading}
              onClick={handleDeleteSelectedVacancies}
              disabled={deleteLoading || selectedVacancyIds.length === 0}
              className="bg-[#ffd0d8] text-[#281118] shadow-none hover:bg-[#ffdbe1]"
            >
              {deleteLoading ? "Deleting Vacancies..." : "Delete Selected Vacancies"}
            </Button>
          </div>
        </div>
      ) : null}

      {items.length === 0 ? (
        <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03)_0%,rgba(255,255,255,0.015)_100%)] px-5 py-5 text-sm text-[#95a8b8]">
          No vacancies found in the database yet.
        </div>
      ) : visibleItems.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.02)_0%,rgba(255,255,255,0.01)_100%)] px-5 py-10 text-center text-sm text-[#95a8b8]">
          {showHistory
            ? "No vacancy history is available to show right now."
            : (
              <>
                Vacancy list hidden from view. New vacancies will appear here automatically.
                Click <span className="font-semibold text-white">Show Hidden</span> to review hidden vacancies or{" "}
                <span className="font-semibold text-white">Restore List</span> to bring the current list back.
              </>
            )}
        </div>
      ) : (
        <VacancyTable
          items={visibleItems}
          selectedIds={selectedVacancyIds}
          onToggleSelect={handleToggleVacancySelect}
          onToggleAll={handleToggleAllVisible}
        />
      )}

      {successMessage ? (
        <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03)_0%,rgba(255,255,255,0.015)_100%)] px-5 py-4 text-sm text-[#dce8f2]">
          {successMessage}
        </div>
      ) : null}
    </div>
  );
}
