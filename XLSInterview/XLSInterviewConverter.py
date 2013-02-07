"""
This tool converts XLSInterviews into JSON interview definitions.
"""
import json, codecs, sys, os, re
import xlrd
import warnings
import datetime

def load_string(path, encoding="utf-8"):
    """
    Load the given file into a string.
    """
    fp = codecs.open(path, mode="r", encoding=encoding)
    result = fp.read()
    fp.close()
    return result

def merge_dictionaries(dict_a, dict_b, default_key = "default"):
    """
    Recursively merge two nested dicts into a single dict.
    When keys match their values are merged using a recursive call to this function,
    otherwise they are just added to the output dict.
    """
    if dict_a is None or dict_a == {}:
        return dict_b
    if dict_b is None or dict_b == {}:
        return dict_a
    
    if type(dict_a) is not dict:
        if default_key in dict_b:
            return dict_b
        dict_a = {default_key : dict_a}
    if type(dict_b) is not dict:
        if default_key in dict_a:
            return dict_a
        dict_b = {default_key : dict_b}
    
    all_keys = set(dict_a.keys()).union(set(dict_b.keys()))
    
    out_dict = dict()
    for key in all_keys:
        out_dict[key] = merge_dictionaries(dict_a.get(key), dict_b.get(key), default_key)
    return out_dict

def list_to_nested_dict(lst):
    """
    [1,2,3,4] -> {1:{2:{3:4}}}
    """
    if len(lst) > 1:
        return {lst[0] : list_to_nested_dict(lst[1:])}
    else:
        return lst[0]

def group_headers(worksheet):
    """
    Construct a JSON object from JSON paths in the headers.
    For now only dot notation is supported.
    For example:
    {"text.english": "hello", "text.french" : "bonjour"}
    becomes
    {"text": {"english": "hello", "french" : "bonjour"}.
    """
    GROUP_DELIMITER = '.'
    #jsonPathRegex = r'\["(.*?)"\]'
    out_worksheet = list()
    for row in worksheet:
        out_row = dict()
        for key, val in row.items():
            tokens = key.split(GROUP_DELIMITER)
            new_key = tokens[0]
            new_value = list_to_nested_dict(tokens[1:] + [val])
            out_row = merge_dictionaries(out_row, { new_key : new_value })
        out_worksheet.append(out_row)
    return out_worksheet

def group_dictionaries(list_of_dicts, key, remove_key = True):
    """
    Takes a list of dictionaries and 
    returns a dictionary of lists of dictionaries with the same value for the given key.
    The grouping key is removed by default.
    If the key is not in any dictionary an empty dict is returned.
    """
    dict_of_lists = dict()
    for dicty in list_of_dicts:
        if key not in dicty: continue
        dicty_value = dicty[key]
        if remove_key: dicty.pop(key)
        if dicty_value in dict_of_lists:
            dict_of_lists[dicty_value].append(dicty)
        else:
            dict_of_lists[dicty_value] = [dicty]
    return dict_of_lists


def xls_to_dict(path_or_file):
    """
    Return a Python dictionary with a key for each worksheet
    name. For each sheet there is a list of dictionaries, each
    dictionary corresponds to a single row in the worksheet. A
    dictionary has keys taken from the column headers and values
    equal to the cell value for that row and column.
    """
    cellFormatString = '[row : %s, column: %s]'
    workbook = None
    if isinstance(path_or_file, basestring):
        workbook = xlrd.open_workbook(filename=path_or_file)
    else:
        workbook = xlrd.open_workbook(file_contents=path_or_file.read())
    result = {}
    for sheet in workbook.sheets():
        #Check for column header errors
        column_headers = {}
        for column_idx in range(0, sheet.ncols):
            ss_col_idx = column_idx + 1
            ch_type = sheet.cell_type(0, column_idx)
            if ch_type == xlrd.XL_CELL_EMPTY:
                #Allow empty column headers so long as 
                #the column doesn't have any values.
                pass
            elif ch_type in [xlrd.XL_CELL_ERROR, xlrd.XL_CELL_DATE]:
                raise Exception("Column header error at [column:" + ss_col_idx + ']')
            else:
                #Only column header keys are striped.
                #Other cells are left alone incase whitespace is used for formating
                column_header = sheet.cell_value(0, column_idx).strip()
                if column_header in column_headers.values():
                    raise Exception("Duplicate column header [" + column_header + "] at [column:" + ss_col_idx + ']')
                elif column_header.startswith('_'):
                    raise Exception("[column:" + ss_col_idx + "] Column header [" + column_header + "] begins with an underscore.")
                else:
                    column_headers[column_idx] = column_header
        result[sheet.name] = []
        for row_idx in range(1, sheet.nrows):#Note that the header row_idx is skipped
            #ss_row_idx offset by 1 to account for 1 based indices of spreadsheets
            ss_row_idx = row_idx + 1
            row_dict = { "_rowNum" : ss_row_idx }
            for column_idx in range(0, sheet.ncols):
                ss_col_idx = column_idx + 1
                if column_idx in column_headers:
                    key = column_headers[column_idx]
                else:
                    raise Exception("Missing column header at [column:" + ss_col_idx + ']')
                value = sheet.cell_value(row_idx, column_idx)
                value_type = sheet.cell_type(row_idx, column_idx)
                if value_type is xlrd.XL_CELL_ERROR:
                    error_location = cellFormatString % (ss_row_idx, ss_col_idx)
                    raise Exception("Cell error at " + error_location)
                if value_type is not xlrd.XL_CELL_EMPTY:
                    if value_type is xlrd.XL_CELL_NUMBER:
                        #Try to parse value as an int if possible.
                        int_value = int(value)
                        if int_value == value:
                            value = int_value
                    elif value_type is xlrd.XL_CELL_BOOLEAN:
                        value = bool(value)
                    elif value_type is xlrd.XL_CELL_DATE:
                        warnings.warn(cellFormatString % (ss_row_idx, ss_col_idx)
                            + " Converting excel date to string."
                            + " To preserve date formatting, begin the date with a single quote (e.g. ').")
                        value = str(datetime.datetime(*xlrd.xldate_as_tuple(value, workbook.datemode)))
                    row_dict[key] = value
            result[sheet.name].append(row_dict)
    return result

def parse_prompts(worksheet):
    rowFormatString = '[row : %s]'
    type_regex = re.compile(r"^(?P<type>\w+)(\s*(?P<param>.+))?$")
    prompt_stack = [{'children' : []}]
    for row in worksheet:
        if 'name' in row:
            #Ensure names are all strings (i.e. not numbers)
            row['name'] = str(row['name'])
        else:
            row['name'] = "question_on_row_%s" % row['_rowNum']
            if (not 'label' in row) and (not 'type' in row):
                continue
        row['type'] = row.get('type', 'none').strip()
        type_parse = type_regex.search(row['type'])
        parse_dict = type_parse.groupdict()
        #Ignore case on types
        parse_dict['type'] = parse_dict['type'].lower()
        if parse_dict['type'] == 'begin':
            row['type'] = parse_dict['param']
            row['children'] = []
            prompt_stack.append(row)
            continue
        elif parse_dict['type'] == 'end':
            if prompt_stack[-1]['type'] == parse_dict['param']:
                top_prompt = prompt_stack.pop()
                prompt_stack[-1]['children'].append(top_prompt)
            else:
                raise Exception(rowFormatString % row['_rowNum'] + " Unmatched end statement.")
            continue
        else:
            row.update(parse_dict)
            prompt_stack[-1]['children'].append(row)
        continue
    if len(prompt_stack) != 1:
        print len(prompt_stack)
        raise Exception("Unmatched begin statement.")
    #print prompt_stack
    return prompt_stack.pop()['children']

def process_workbook(workbook):
    for worksheet_name, worksheet in workbook.items():
        workbook[worksheet_name] = group_headers(worksheet)
    workbook['interview'] = parse_prompts(workbook['interview'])
    return workbook

def convert_json_workbook(workbook, output_path):
    with codecs.open(output_path, mode="w", encoding="utf-8") as fp:
        json.dump(process_workbook(workbook), fp=fp, ensure_ascii=False, indent=4)

def convert_excel_workbook(path_or_file, output_path):
    convert_json_workbook(xls_to_dict(path_or_file), output_path)

if __name__ == "__main__":
    """
    This code is for running XLSForm as a command line script.
    """
    argv = sys.argv
    if len(argv) < 3:
        print __doc__
        print 'Usage:'
        print argv[0] + ' path_to_XLSForm output_path'
    else:        
        convert_excel_workbook(argv[1], argv[2])
        print 'Conversion complete!'
