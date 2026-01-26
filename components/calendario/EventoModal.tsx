'use client';

import { EventoHorario } from '@/types/calendario';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  X,
  Clock,
  MapPin,
  Users,
  BookOpen,
  Calendar,
  GraduationCap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EventoModalProps {
  evento: EventoHorario | null;
  onClose: () => void;
}

export function EventoModal({ evento, onClose }: EventoModalProps) {
  if (!evento) return null;

  const dayName = format(evento.start, "EEEE", { locale: ptBR });
  const formattedDate = format(evento.start, "d 'de' MMMM", { locale: ptBR });

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-3xl max-w-md w-full shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with gradient and pattern */}
        <div className="relative bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 p-6 pb-8">
          {/* Decorative circles */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-20 h-20 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-xl transition-colors"
          >
            <X className="h-5 w-5 text-white" />
          </button>

          {/* Title and time */}
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full text-white/90 text-xs font-medium mb-3">
              <Calendar className="h-3 w-3" />
              <span className="capitalize">{dayName}, {formattedDate}</span>
            </div>
            <h3 className="text-2xl font-bold text-white leading-tight pr-8">
              {evento.title}
            </h3>
            <div className="flex items-center gap-2 mt-3">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 rounded-lg">
                <Clock className="h-4 w-4 text-white" />
                <span className="text-sm font-medium text-white">
                  {format(evento.start, "HH:mm", { locale: ptBR })} - {format(evento.end, "HH:mm", { locale: ptBR })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 -mt-4">
          {/* Info cards */}
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-4 space-y-4">
            {/* Location */}
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-xl flex items-center justify-center flex-shrink-0 border border-emerald-500/20">
                <MapPin className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">Localização</p>
                <p className="font-semibold text-gray-900 dark:text-white mt-0.5">
                  {evento.extendedProps.predio}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {evento.extendedProps.bloco} • Sala {evento.extendedProps.sala}
                </p>
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700" />

            {/* Turma */}
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-xl flex items-center justify-center flex-shrink-0 border border-blue-500/20">
                <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">Turma</p>
                <p className="font-semibold text-gray-900 dark:text-white mt-0.5">
                  {evento.extendedProps.turma}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Subturma: {evento.extendedProps.subturma}
                </p>
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700" />

            {/* Código da Disciplina */}
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-xl flex items-center justify-center flex-shrink-0 border border-purple-500/20">
                <BookOpen className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">Código</p>
                <p className="font-semibold text-gray-900 dark:text-white mt-0.5 font-mono">
                  {evento.extendedProps.codDisc}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6">
          <Button
            onClick={onClose}
            className="w-full h-12 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/25 transition-all duration-200 hover:shadow-xl hover:shadow-emerald-500/30 hover:-translate-y-0.5"
          >
            Fechar
          </Button>
        </div>
      </div>
    </div>
  );
}
