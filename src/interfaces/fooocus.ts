export interface TextToImageParams {
  prompt: string;
  negative_prompt?: string;
  style_selections?: string[];
  performance_selection?: "Speed" | "Quality" | "Extreme Speed";
  aspect_ratios_selection?: string;
  image_number?: number;
  image_seed?: number;
  sharpness?: number;
  guidance_scale?: number;
  async_process?: boolean;
  save_extension?: "png" | "jpg" | "webp";
}

export interface TextToImageResponse {
  job_id?: string;
  job_result?: ImageResult[];
  job_status?: string;
  job_group?: string;
  job_progress?: number;
}

export interface ImageResult {
  url: string;
  seed?: number;
  base64_image?: string;
}

export interface JobStatusResponse {
  job_stage: "PENDING" | "RUNNING" | "COMPLETED" | "ERROR";
  job_status?: string;
  job_progress?: number;
  job_step_info?: string;
  job_result?: ImageResult[];
  job_id?: string;
  job_error?: string;
}
