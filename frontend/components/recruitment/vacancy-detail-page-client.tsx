"use client";

import { useEffect, useMemo, useState } from "react";
import { notFound } from "next/navigation";

import { apiRequest } from "@/lib/api/client";
import type {
  DepartmentOption,
  VacancyApiRecord,
  VacancyRecord,
} from "@/lib/recruitment-types";
import { VacancyDetail } from "@/components/recruitment/vacancy-detail";

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

export function VacancyDetailPageClient({ id }: { id: string }) {
  const [vacancy, setVacancy] = useState<VacancyApiRecord | null>(null);
  const [departments, setDepartments] = useState<DepartmentOption[]>(fallbackDepartments);
  const [missing, setMissing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [vacancyResponse, departmentResponse] = await Promise.all([
          apiRequest<VacancyApiRecord>({ path: `/vacancies/${id}` }),
          apiRequest<DepartmentOption[]>({ path: "/departments/" }).catch(() => fallbackDepartments),
        ]);

        setVacancy(vacancyResponse);
        setDepartments(departmentResponse.length > 0 ? departmentResponse : fallbackDepartments);
        setErrorMessage(null);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load vacancy.";
        if (message.includes("404")) {
          setMissing(true);
          return;
        }
        setErrorMessage(message);
      }
    };

    void loadData();
  }, [id]);

  const vacancyRecord = useMemo(
    () => (vacancy ? mapVacancyToRecord(vacancy, departments) : null),
    [vacancy, departments]
  );

  if (missing) {
    notFound();
  }

  if (errorMessage) {
    return (
      <div className="rounded-[24px] border border-[#b85b68]/35 bg-[rgba(184,91,104,0.12)] px-5 py-4 text-sm font-medium text-[#f0b6bf]">
        {errorMessage}
      </div>
    );
  }

  if (!vacancyRecord) {
    return (
      <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03)_0%,rgba(255,255,255,0.015)_100%)] px-5 py-5 text-sm text-[#95a8b8]">
        Loading vacancy...
      </div>
    );
  }

  return <VacancyDetail vacancy={vacancyRecord} />;
}
