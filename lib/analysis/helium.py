# Helium Interactive Analysis Script
# Analyzes traffic metrics over time (organic/paid traffic, keywords, costs)

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import os
import io
import re
import json
from typing import Optional, Dict, List

# Set up Matplotlib to use Poppins font if available
try:
    import matplotlib.font_manager as fm
    font_path = '/tmp/Poppins-Regular.ttf'
    if os.path.exists(font_path):
        fm.fontManager.addfont(font_path)
        plt.rc('font', family='Poppins')
except:
    pass

# Brand colors
PRIMARY = '#001330'      # (navy)
ACCENT = '#E6475F'       # (red)
SECONDARY = '#1A2C5A'    # (blue)
TERTIARY = '#ADC0ED'     # (light blue)
BACKGROUND = '#EFF2FB'   # (pale blue)

def validate_df_structure(df: pd.DataFrame) -> tuple[bool, List[str]]:
    """Validate CSV matches expected structure."""
    error_messages = []
    
    if len(df) != 6:
        error_messages.append(f"File must have exactly 6 rows, but it has {len(df)}.")
    
    if 'Metric' not in df.columns:
        error_messages.append("File is missing the required 'Metric' column.")
    
    date_columns = [col for col in df.columns if re.match(r'^\d{4}-\d{2}-\d{2}$', col)]
    if len(date_columns) < 3:
        error_messages.append(f"File must have at least 3 date columns in format 'YYYY-MM-DD', but found {len(date_columns)}.")
    
    if error_messages:
        return False, error_messages
    
    # Validate 'Metric' column content
    required_metrics = {
        'organic traffic',
        'organic keywords',
        'organic traffic cost',
        'paid traffic',
        'paid keywords',
        'paid traffic cost'
    }
    
    if not pd.api.types.is_string_dtype(df['Metric']) and not pd.api.types.is_object_dtype(df['Metric']):
        error_messages.append("'Metric' column must contain text/string data.")
        return False, error_messages
    
    metric_values_in_file = set(df['Metric'].str.lower())
    if metric_values_in_file != required_metrics:
        missing = required_metrics - metric_values_in_file
        extra = metric_values_in_file - required_metrics
        if missing:
            error_messages.append(f"Missing required metrics: {', '.join(missing)}")
        if extra:
            error_messages.append(f"Invalid metrics found: {', '.join(extra)}")
        return False, error_messages
    
    # Validate data types of date columns
    non_integer_date_cols = []
    for col in date_columns:
        if not pd.api.types.is_integer_dtype(df[col]):
            non_integer_date_cols.append(col)
    
    if non_integer_date_cols:
        error_messages.append(f"Non-integer values in date columns: {', '.join(non_integer_date_cols)}")
        return False, error_messages
    
    return True, []

def create_dual_axis_plot(df, y1_metric, y2_metric, title, figsize=(12, 6)):
    """Create a dual-axis line plot comparing two metrics over time."""
    fig, ax1 = plt.subplots(figsize=figsize)
    
    ax1.set_xlabel('Date')
    ax1.set_ylabel(y1_metric, color=PRIMARY)
    line1 = ax1.plot(df.index, df[y1_metric], color=PRIMARY, label=y1_metric)
    ax1.tick_params(axis='y', labelcolor=PRIMARY)
    
    ax2 = ax1.twinx()
    ax2.set_ylabel(y2_metric, color=ACCENT)
    line2 = ax2.plot(df.index, df[y2_metric], color=ACCENT, label=y2_metric)
    ax2.tick_params(axis='y', labelcolor=ACCENT)
    
    lines = line1 + line2
    labels = [l.get_label() for l in lines]
    ax1.legend(lines, labels, loc='upper right')
    
    plt.title(title)
    ax1.set_xticks(df.index)
    ax1.xaxis.set_major_formatter(plt.matplotlib.dates.DateFormatter('%Y-%m'))
    ax1.tick_params(axis='x', rotation=45)
    plt.tight_layout()
    
    return fig

def create_triple_line_plot(df, metrics, title, figsize=(12, 6)):
    """Create a single-axis line plot comparing three metrics over time."""
    fig, ax = plt.subplots(figsize=figsize)
    
    ax.plot(df.index, df[metrics[0]], color=PRIMARY, label=metrics[0])
    ax.plot(df.index, df[metrics[1]], color=ACCENT, label=metrics[1])
    ax.plot(df.index, df[metrics[2]], color=SECONDARY, label=metrics[2])
    
    ax.set_xlabel('Date')
    ax.set_ylabel('Value')
    ax.set_title(title)
    
    ax.set_xticks(df.index)
    ax.xaxis.set_major_formatter(plt.matplotlib.dates.DateFormatter('%Y-%m'))
    ax.tick_params(axis='x', rotation=45)
    ax.legend(loc='upper right')
    plt.tight_layout()
    
    return fig

def run_analysis(input_file: str, output_dir: str, config: Optional[Dict] = None) -> Dict:
    """Main analysis function for Helium traffic metrics."""
    results = {
        "success": False,
        "errors": [],
        "artifacts": [],
        "summary": {}
    }
    
    try:
        # Read CSV
        df = pd.read_csv(input_file)
        
        # Validate structure
        is_valid, errors = validate_df_structure(df)
        if not is_valid:
            results["errors"] = errors
            return results
        
        # Clean and process data
        dropping_cols = ['Target', 'Target Type', 'Database', 'Summary']
        cleaned_df = df.drop([col for col in dropping_cols if col in df.columns], axis=1)
        cleaned_df['Metric'] = cleaned_df['Metric'].astype('string')
        
        # Remove columns where all values are 0 or NaN
        cleaned_df = cleaned_df.loc[:, (cleaned_df != 0).any()]
        cleaned_df = cleaned_df.dropna(axis=1, how='all')
        
        # Pivot table
        melted_df = cleaned_df.melt(
            id_vars='Metric',
            value_vars=None,
            var_name='Date',
            value_name='Value'
        )
        melted_df['Date'] = pd.to_datetime(melted_df['Date'])
        
        pivoted_df = melted_df.pivot_table(
            values='Value',
            index='Date',
            columns='Metric',
            aggfunc='first'
        )
        
        # Filter to most recent year
        end_date = pivoted_df.index.max()
        start_date = end_date - pd.DateOffset(years=1)
        filtered_df = pivoted_df.loc[start_date:end_date]
        
        # Aggregate by month
        df_monthly = filtered_df.resample('ME').sum()
        
        # Create charts
        os.makedirs(output_dir, exist_ok=True)
        
        # Chart 1: Organic Traffic vs Organic Keywords
        fig1 = create_dual_axis_plot(
            df_monthly,
            'Organic Traffic',
            'Organic Keywords',
            'Organic Traffic vs Organic Keywords'
        )
        chart1_path = os.path.join(output_dir, 'organic_traffic_vs_keywords.png')
        fig1.savefig(chart1_path, dpi=150, bbox_inches='tight')
        plt.close(fig1)
        results["artifacts"].append({
            "name": "organic_traffic_vs_keywords.png",
            "type": "chart",
            "path": chart1_path
        })
        
        # Chart 2: Paid Traffic, Cost vs Keywords
        fig2 = create_triple_line_plot(
            df_monthly,
            ['Paid Traffic', 'Paid Traffic Cost', 'Paid Keywords'],
            'Paid Traffic, Paid Traffic Cost vs Paid Keywords'
        )
        chart2_path = os.path.join(output_dir, 'paid_metrics.png')
        fig2.savefig(chart2_path, dpi=150, bbox_inches='tight')
        plt.close(fig2)
        results["artifacts"].append({
            "name": "paid_metrics.png",
            "type": "chart",
            "path": chart2_path
        })
        
        # Generate summary statistics
        results["summary"] = {
            "total_organic_traffic": int(df_monthly['Organic Traffic'].sum()),
            "total_paid_traffic": int(df_monthly['Paid Traffic'].sum()),
            "avg_monthly_organic": float(df_monthly['Organic Traffic'].mean()),
            "avg_monthly_paid": float(df_monthly['Paid Traffic'].mean()),
            "date_range": {
                "start": start_date.strftime('%Y-%m-%d'),
                "end": end_date.strftime('%Y-%m-%d')
            }
        }
        
        # Save processed data
        csv_path = os.path.join(output_dir, 'processed_monthly_data.csv')
        df_monthly.to_csv(csv_path)
        results["artifacts"].append({
            "name": "processed_monthly_data.csv",
            "type": "csv",
            "path": csv_path
        })
        
        results["success"] = True
        
    except Exception as e:
        results["errors"].append(f"Analysis error: {str(e)}")
    
    return results 