"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, LoaderCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/api/client";
import type { DepartmentOption, VacancyApiRecord } from "@/lib/recruitment-types";

type EditVacancyModalProps = {
  vacancy: VacancyApiRecord;
  departments: DepartmentOption[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedVacancy: VacancyApiRecord) => void;
};

export function EditVacancyModal({
  vacancy,
  departments,
  isOpen,
  onClose,
  onSuccess,
}: EditVacancyModalProps) {
  const [title, setTitle] = useState(vacancy.title || "");
  const [departmentId, setDepartmentId] = useState(String(vacancy.department_id || "1"));
  const [status, setStatus] = useState<string>(vacancy.status || "open");
  const [location, setLocation] = useState(
    (vacancy.parsed_data?.location as string) || "Amsterdam, Netherlands"
  );
  const [employmentType, setEmploymentType] = useState(
    (vacancy.parsed_data?.employment_type as string) || "Full-time"
  );
  const [experienceLevel, setExperienceLevel] = useState(
    vacancy.experience_level || "MID"
  );
  const [description, setDescription] = useState(vacancy.description || "");

  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMessage("Vacancy title is required.");
      return;
    }

    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const updatedParsedData = {
        ...(vacancy.parsed_data || {}),
        location: location.trim(),
        employment_type: employmentType,
      };

      const response = await apiRequest<VacancyApiRecord>({
        path: `/vacancies/${vacancy.id}`,
        method: "PUT",
        body: JSON.stringify({
          title: title.trim(),
          department_id: Number(departmentId),
          status,
          experience_level: experienceLevel,
          description: description.trim(),
          parsed_data: updatedParsedData,
        }),
      });

      setSuccessMessage("Vacancy updated successfully.");
      setTimeout(() => {
        onSuccess(response);
        onClose();
      }, 600);
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to update vacancy.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-white/10 bg-[#121922] p-6 shadow-2xl md:p-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[#728696]">
              Internal System Vacancy
            </span>
            <h2 className="text-xl font-bold text-white tracking-tight mt-1">
              Edit Vacancy #{vacancy.id}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-[#728696] hover:bg-white/5 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Error / Success */}
        {errorMessage && (
          <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-200">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
            <span>{errorMessage}</span>
          </div>
        )}
        {successMessage && (
          <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-200">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSave} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#9bb0bf] mb-1.5">
              Vacancy Title <span className="text-red-400">*</span>
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Senior Backend Engineer"
              className="h-11 rounded-xl border-white/10 bg-[#0c1219] text-white"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#9bb0bf] mb-1.5">
                Department
              </label>
              <Select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="h-11 rounded-xl border-white/10 bg-[#0c1219] text-white"
              >
                {departments.map((dep) => (
                  <option key={dep.id} value={String(dep.id)}>
                    {dep.name}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#9bb0bf] mb-1.5">
                Status
              </label>
              <Select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="h-11 rounded-xl border-white/10 bg-[#0c1219] text-white"
              >
                <option value="open">Open (Active)</option>
                <option value="on_hold">On Hold</option>
                <option value="closed">Closed</option>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#9bb0bf] mb-1.5">
                Location
              </label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Amsterdam, Netherlands"
                className="h-11 rounded-xl border-white/10 bg-[#0c1219] text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#9bb0bf] mb-1.5">
                Employment Type
              </label>
              <Select
                value={employmentType}
                onChange={(e) => setEmploymentType(e.target.value)}
                className="h-11 rounded-xl border-white/10 bg-[#0c1219] text-white"
              >
                <option value="Full-time">Full-time</option>
                <option value="Part-time">Part-time</option>
                <option value="Contract">Contract</option>
                <option value="Freelance">Freelance</option>
                <option value="Internship">Internship</option>
              </Select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#9bb0bf] mb-1.5">
              Experience Level
            </label>
            <Select
              value={experienceLevel}
              onChange={(e) => setExperienceLevel(e.target.value)}
              className="h-11 rounded-xl border-white/10 bg-[#0c1219] text-white"
            >
              <option value="JUNIOR">Junior (0 - 2 yrs)</option>
              <option value="MID">Mid-level (2 - 5 yrs)</option>
              <option value="SENIOR">Senior (5+ yrs)</option>
              <option value="LEAD">Lead / Principal</option>
            </Select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#9bb0bf] mb-1.5">
              Description / Job Overview
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter full job description..."
              rows={7}
              className="rounded-xl border-white/10 bg-[#0c1219] text-white text-xs leading-relaxed"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl border-white/10 bg-white/5 text-[#dae3ee] hover:bg-white/10"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-[#72d0ed] px-6 text-[#003642] font-semibold hover:bg-[#8adcf4] transition"
            >
              {saving ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin mr-2" />
                  Saving…
                </>
              ) : (
                "Save Vacancy Changes"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
